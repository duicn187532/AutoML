import type * as TF from '@tensorflow/tfjs';
import { analyze, analysisOk } from '../../dag/graph';
import { balanceLoss, compileGraph, type CompileContext } from '../../dag/compile';
import { getColumn } from '../../data/table';
import { takeVector, type Matrix } from '../../ml/matrix';
import { classificationMetrics, regressionMetrics, type MetricSet } from '../../ml/metrics';
import { DEFAULT_PREPROCESS, encodeTarget, fitPreprocessor, fitTarget, inferTask, transform, type TargetState } from '../../ml/preprocess';
import { holdoutSplit, kFold } from '../../ml/split';
import { prepareExpertFold, toOuterTargetScale } from '../../ml/expertFold';
import { defaultParams } from '../../models/params';
import { getPlugin } from '../../models/registry';
import { Rng } from '../../rng';
import type { GateStats, TaskContext, TrainGraphInput, TrainGraphOutput } from '../types';

type Tf = typeof TF;

/** Sparse categorical cross-entropy / MSE, scaled by a head weight (multi-task). */
function weightedLoss(tf: Tf, kind: 'sce' | 'mse', w: number) {
  return (yTrue: TF.Tensor, yPred: TF.Tensor) => tf.tidy(() => {
    if (kind === 'mse') return tf.mul(tf.mean(tf.square(tf.sub(yTrue, yPred))), w);
    // yTrue is one-hot (TF.js checks custom-loss targets against the output shape)
    const ll = tf.sum(tf.mul(yTrue, tf.log(tf.clipByValue(yPred, 1e-7, 1))), -1);
    return tf.mul(tf.neg(tf.mean(ll)), w);
  });
}

/** Mean routing weight / share of samples / distinguishing features per expert. */
function gateStats(weights: Float32Array, E: number, X: Matrix, names: string[]): GateStats {
  const n = X.rows;
  const meanWeight = new Array<number>(E).fill(0), count = new Array<number>(E).fill(0);
  const sums = Array.from({ length: E }, () => new Float64Array(X.cols));
  for (let i = 0; i < n; i++) {
    let best = 0;
    for (let e = 0; e < E; e++) { meanWeight[e] += weights[i * E + e] / n; if (weights[i * E + e] > weights[i * E + best]) best = e; }
    count[best]++;
    for (let j = 0; j < X.cols; j++) sums[best][j] += X.data[i * X.cols + j];
  }
  const top = sums.map((s, e) => names.map((name, j) => ({ name, z: count[e] ? s[j] / count[e] : 0 })).sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 4));
  return { meanWeight, share: count.map((c) => c / n), topFeatures: top };
}

export async function trainGraphTask(input: TrainGraphInput, ctx: TaskContext): Promise<TrainGraphOutput> {
  const t0 = performance.now();
  const tf = ctx.engine<Tf>('tfjs');
  const { table, graph } = input;
  const rng = new Rng(input.seed);
  const heads = graph.nodes.filter((n) => n.type === 'head');
  const targetsCols = heads.map((h) => String(h.params.target));
  const features = input.features.filter((f) => !targetsCols.includes(f));

  // targets per head (class lists from all rows), rows labelled for every head
  const allIdx = Int32Array.from({ length: table.rowCount }, (_, i) => i);
  const headInfo = heads.map((h) => {
    const col = String(h.params.target);
    const task = inferTask(getColumn(table, col));
    const cls = task === 'regression' ? null : fitTarget(table, col, task, allIdx);
    const y = encodeTarget(cls ?? { task: 'regression', column: col, mean: 0, std: 1 }, table);
    return { id: h.id, col, task, cls, y, weight: Number(h.params.weight) || 1 };
  });
  const labelled: number[] = [];
  for (let i = 0; i < table.rowCount; i++) if (headInfo.every((h) => !Number.isNaN(h.y[i]))) labelled.push(i);
  if (labelled.length < 20) throw new Error('Too few rows with all head targets present');
  const L = Int32Array.from(labelled);
  const strat = headInfo[0].cls ? takeVector(headInfo[0].y, L) : undefined;
  const sp = holdoutSplit(L.length, rng.fork('split'), { validFraction: input.validFraction, stratify: strat });
  const trainRows = takeVector(L, sp.train), validRows = takeVector(L, sp.valid);

  const prep = fitPreprocessor(table, features, trainRows, DEFAULT_PREPROCESS);
  const Xtr = transform(prep, table, trainRows), Xva = transform(prep, table, validRows);
  const targets: Record<string, TargetState> = {};
  const enc = (h: (typeof headInfo)[number], rows: Int32Array) => {
    const y = takeVector(h.y, rows);
    const t = targets[h.id];
    if (t.task === 'regression') for (let i = 0; i < y.length; i++) y[i] = (y[i] - t.mean) / t.std;
    return y;
  };
  for (const h of headInfo) targets[h.id] = h.cls ?? fitTarget(table, h.col, 'regression', trainRows);
  const targetDims = Object.fromEntries(headInfo.map((h) => [h.col, h.cls && h.cls.task !== 'regression' ? h.cls.classes.length : 1]));
  const a = analyze(graph, { inputDim: Xtr.cols, targetDims, features });
  if (!analysisOk(a)) throw new Error(`Graph has errors: ${[...a.errors, ...Object.entries(a.info).flatMap(([id, i]) => i.errors.map((e) => `${id}:${e}`))].join(', ')}`);

  // rule gates → standardised threshold on the feature's numeric column
  const rules: CompileContext['rules'] = {};
  for (const g of graph.nodes.filter((n) => n.type === 'gate' && n.params.mode === 'rule')) {
    const f = String(g.params.ruleFeature);
    const step = prep.steps.find((s) => s.column === f);
    if (!step || step.type !== 'numeric') throw new Error(`Rule gate feature "${f}" must be a numeric feature`);
    rules[g.id] = { index: prep.outputNames.indexOf(f), z: (Number(g.params.ruleThreshold) - step.center) / step.scale };
  }
  const history: Record<string, number[]> = { epoch: [], loss: [], val_loss: [] };
  const metrics: Record<string, MetricSet> = {};
  const gates: Record<string, GateStats> = {};
  const toT = (m: Matrix) => tf.tensor2d(Float32Array.from(m.data), [m.rows, m.cols]);
  const yT = (h: (typeof headInfo)[number], y: Float64Array) => (h.task === 'regression' ? tf.tensor2d(Float32Array.from(y), [y.length, 1]) : tf.tensor1d(Float32Array.from(y)));
  const evalHead = (h: (typeof headInfo)[number], P: Float32Array, rows: Int32Array): MetricSet => {
    const t = targets[h.id];
    if (t.task === 'regression') return regressionMetrics(takeVector(h.y, rows), Float64Array.from(P, (v) => v * t.std + t.mean));
    return classificationMetrics(takeVector(h.y, rows), { rows: rows.length, cols: t.classes.length, data: Float64Array.from(P) }).metrics;
  };
  const notes: string[] = [];
  let weightsOut: { shape: number[]; data: number[] }[] = [];
  let experts: TrainGraphOutput['experts'];

  if (a.mode === 'end-to-end') {
    const c = compileGraph(tf, graph, { inputDim: Xtr.cols, heads: Object.fromEntries(headInfo.map((h) => [h.id, { target: h.col, task: h.task, dim: targetDims[h.col], weight: h.weight }])), rules, seed: input.seed });
    // TF.js has no lossWeights → weighted custom loss per output
    const losses = c.outputs.map((o) => {
      if (o.kind === 'balance') { const w = Number(graph.nodes.find((n) => n.id === o.node)!.params.balance); const f = balanceLoss(tf); return (a: TF.Tensor, b: TF.Tensor) => tf.mul(f(a, b), w); }
      const h = headInfo.find((x) => x.id === o.node)!;
      return weightedLoss(tf, h.task === 'regression' ? 'mse' : 'sce', h.weight);
    });
    c.model.compile({ optimizer: tf.train.adam(input.learningRate), loss: losses as never });
    notes.push(`params: ${c.model.countParams().toLocaleString()}`);
    const ysFor = (rows: Int32Array) => c.outputs.map((o) => {
      if (o.kind === 'balance') { const E = graph.edges.filter((e) => e.to === o.node && e.port === 'in').length; return tf.zeros([rows.length, E]); }
      const h = headInfo.find((x) => x.id === o.node)!;
      const y = enc(h, rows);
      return h.task === 'regression' ? yT(h, y) : tf.oneHot(tf.tensor1d(Int32Array.from(y), 'int32'), targetDims[h.col]).toFloat();
    });
    const xAll = toT(Xtr), xv = toT(Xva), ysAll = ysFor(trainRows), ysV = ysFor(validRows);
    let best = { loss: Infinity, epoch: 0, w: [] as TF.Tensor[] }, since = 0;
    try {
      for (let epoch = 1; epoch <= input.epochs; epoch++) {
        const perm = tf.tensor1d(rng.fork(`ep${epoch}`).permutation(Xtr.rows), 'int32');
        const xs = tf.gather(xAll, perm), ys = ysAll.map((y) => tf.gather(y, perm));
        const hst = await c.model.fit(xs, ys.length === 1 ? ys[0] : ys, { epochs: 1, batchSize: input.batchSize, shuffle: false, verbose: 0 });
        tf.dispose([perm, xs, ...ys]);
        const loss = Number(hst.history.loss[0]);
        const ev = c.model.evaluate(xv, ysV.length === 1 ? ysV[0] : ysV, { batchSize: 1024 });
        const vl = (await (Array.isArray(ev) ? ev[0] : ev).data())[0];
        tf.dispose(ev);
        history.epoch.push(epoch); history.loss.push(loss); history.val_loss.push(vl);
        ctx.progress({ fraction: epoch / input.epochs, point: { epoch, loss, val_loss: vl } });
        if (vl < best.loss - 1e-7) { tf.dispose(best.w); best = { loss: vl, epoch, w: c.model.getWeights().map((w) => w.clone()) }; since = 0; }
        else if (input.patience > 0 && ++since >= input.patience) break;
        await ctx.checkpoint();
      }
      if (best.w.length) c.model.setWeights(best.w);
      notes.push(`best epoch ${best.epoch}`);
      const preds = c.model.predict(xv, { batchSize: 1024 });
      const arr = Array.isArray(preds) ? preds : [preds];
      for (const [k, o] of c.outputs.entries()) if (o.kind === 'head') metrics[o.node] = evalHead(headInfo.find((h) => h.id === o.node)!, arr[k].dataSync() as Float32Array, validRows);
      tf.dispose(arr);
      for (const [id, probe] of Object.entries(c.gateProbes)) {
        const w = probe.predict(xv) as TF.Tensor;
        gates[id] = gateStats(w.dataSync() as Float32Array, w.shape[1] as number, Xva, prep.outputNames);
        w.dispose();
      }
      weightsOut = c.model.getWeights().map((w) => ({ shape: w.shape, data: Array.from(w.dataSync()) }));
    } finally {
      tf.dispose([xAll, xv, ...ysAll, ...ysV, ...best.w]);
      c.model.dispose();
    }
  } else {
    // ---- two-stage: experts (any plugin) via k-fold OOF, then a TF.js gate on top ----
    const gate = graph.nodes.find((n) => n.type === 'gate');
    const h = headInfo[0];
    if (!gate || heads.length !== 1) throw new Error('Two-stage training supports one gate and one head');
    const expertNodes = graph.edges.filter((e) => e.to === gate.id && e.port === 'in').map((e) => graph.nodes.find((n) => n.id === e.from)!);
    if (expertNodes.some((n) => n.type !== 'expert')) throw new Error('In two-stage mode every gate input must be an expert node');
    const k = targetDims[h.col], cls = h.task !== 'regression';
    const ytr = enc(h, trainRows);
    const folds = kFold(Xtr.rows, 5, rng.fork('oof'), cls ? ytr : undefined);
    const P = new Float32Array(Xtr.rows * expertNodes.length * k), Pv = new Float32Array(Xva.rows * expertNodes.length * k);
    experts = [];
    for (const [ei, en] of expertNodes.entries()) {
      const pluginId = en.params.model === 'neural' ? 'mlp' : String(en.params.model);
      const plugin = getPlugin(pluginId === 'logistic' && !cls ? 'ridge' : pluginId);
      const params = { ...defaultParams(plugin, h.task), ...(pluginId === 'mlp' ? { units: Number(en.params.units), hiddenLayers: Number(en.params.layers), dropout: Number(en.params.dropout), epochs: 100 } : {}) };
      const fitPredict = async (Xa: Matrix, ya: Float64Array, Xb: Matrix, seedLabel: string) => {
        const m = plugin.create({ task: h.task, nFeatures: Xa.cols, nClasses: cls ? k : 0, params, rng: rng.fork(`${seedLabel}-i`), engine: ctx.engine });
        await m.fit({ X: Xa, y: ya }, { rng: rng.fork(`${seedLabel}-f`), engine: ctx.engine, checkpoint: ctx.checkpoint, progress: () => {} });
        const out = cls ? m.predictProba!(Xb).data : m.predict(Xb);
        m.dispose?.();
        return out;
      };
      for (const [fi, f] of folds.entries()) {
        ctx.progress({ fraction: (ei * (folds.length + 1) + fi) / (expertNodes.length * (folds.length + 1)) * 0.7, message: `expert ${en.label ?? pluginId} fold ${fi + 1}` });
        // Inner validation rows must not affect expert preprocessing or regression scaling.
        const part = prepareExpertFold(table, features, trainRows, f, h.col, h.y, targets[h.id]);
        const o = await fitPredict(part.Xtrain, part.ytrain, part.Xvalid, `${en.id}-${fi}`);
        for (let i = 0; i < f.valid.length; i++) for (let j = 0; j < k; j++) {
          const pred = cls ? o[i * k + j] : toOuterTargetScale(o[i * k + j], part.target, targets[h.id]);
          P[(f.valid[i] * expertNodes.length + ei) * k + j] = pred;
        }
      }
      const t1 = performance.now();
      const o = await fitPredict(Xtr, ytr, Xva, `${en.id}-full`);
      for (let i = 0; i < Xva.rows; i++) for (let j = 0; j < k; j++) Pv[(i * expertNodes.length + ei) * k + j] = o[i * k + j];
      const solo = cls ? classificationMetrics(enc(h, validRows), { rows: Xva.rows, cols: k, data: Float64Array.from(o) }).metrics
        : regressionMetrics(takeVector(h.y, validRows), Float64Array.from(o, (v) => v * (targets[h.id] as { std: number }).std + (targets[h.id] as { mean: number }).mean));
      experts.push({ node: en.id, pluginId: plugin.id, metrics: solo, fitMs: performance.now() - t1 });
    }
    // stage 2: gate(X) softmax over experts, output = Σ g_e · P_e
    const E = expertNodes.length;
    const xIn = tf.input({ shape: [Xtr.cols] }), pIn = tf.input({ shape: [E, k] });
    let hdn: TF.SymbolicTensor = xIn;
    if (Number(gate.params.hidden) > 0) hdn = tf.layers.dense({ units: Number(gate.params.hidden), activation: 'relu', kernelInitializer: tf.initializers.glorotUniform({ seed: input.seed }) }).apply(hdn) as TF.SymbolicTensor;
    const g = tf.layers.dense({ units: E, activation: 'softmax', kernelInitializer: tf.initializers.glorotUniform({ seed: input.seed + 1 }) }).apply(hdn) as TF.SymbolicTensor;
    const mix = tf.layers.dot({ axes: [1, 1] }).apply([g, pIn]) as TF.SymbolicTensor;
    const model = tf.model({ inputs: [xIn, pIn], outputs: mix });
    const probe = tf.model({ inputs: [xIn, pIn], outputs: g });
    model.compile({ optimizer: tf.train.adam(input.learningRate), loss: cls ? 'sparseCategoricalCrossentropy' : 'meanSquaredError' });
    const xT = toT(Xtr), pT = tf.tensor3d(P, [Xtr.rows, E, k]), yTr = yT(h, ytr);
    const xV = toT(Xva), pV = tf.tensor3d(Pv, [Xva.rows, E, k]), yV = yT(h, enc(h, validRows));
    try {
      let best = { loss: Infinity, epoch: 0, w: [] as TF.Tensor[] }, since = 0;
      for (let epoch = 1; epoch <= input.epochs; epoch++) {
        const hst = await model.fit([xT, pT], yTr, { epochs: 1, batchSize: input.batchSize, shuffle: true, verbose: 0 });
        const ev = model.evaluate([xV, pV], yV) as TF.Scalar;
        const vl = (await ev.data())[0];
        ev.dispose();
        history.epoch.push(epoch); history.loss.push(Number(hst.history.loss[0])); history.val_loss.push(vl);
        ctx.progress({ fraction: 0.7 + 0.3 * (epoch / input.epochs), point: { epoch, loss: Number(hst.history.loss[0]), val_loss: vl } });
        if (vl < best.loss - 1e-7) { tf.dispose(best.w); best = { loss: vl, epoch, w: model.getWeights().map((w) => w.clone()) }; since = 0; }
        else if (input.patience > 0 && ++since >= input.patience) break;
        await ctx.checkpoint();
      }
      if (best.w.length) model.setWeights(best.w);
      tf.dispose(best.w);
      const pred = model.predict([xV, pV]) as TF.Tensor;
      metrics[h.id] = evalHead(h, pred.dataSync() as Float32Array, validRows);
      pred.dispose();
      const w = probe.predict([xV, pV]) as TF.Tensor;
      gates[gate.id] = gateStats(w.dataSync() as Float32Array, E, Xva, prep.outputNames);
      w.dispose();
      weightsOut = model.getWeights().map((x) => ({ shape: x.shape, data: Array.from(x.dataSync()) }));
      notes.push('two-stage: fold-local preprocessing/target scaling, 5-fold OOF expert predictions and frozen-expert gate');
    } finally {
      tf.dispose([xT, pT, yTr, xV, pV, yV]);
      model.dispose();
    }
  }
  return {
    mode: a.mode, metrics, heads: headInfo.map((h) => ({ node: h.id, target: h.col, task: h.task, classes: h.cls && h.cls.task !== 'regression' ? h.cls.classes : undefined })),
    gates, experts, history, notes, totalParams: a.totalParams, nTrain: trainRows.length, nValid: validRows.length,
    artifact: { graph, preprocessor: prep, targets, weights: weightsOut }, durationMs: performance.now() - t0,
  };
}
