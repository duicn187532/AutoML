import { blend, caruanaSelection, type OofPrediction } from '../../auto/ensemble';
import { portfolio, type PortfolioEntry } from '../../auto/portfolio';
import { tpeConfig, type SearchDim } from '../../auto/search';
import { getColumn } from '../../data/table';
import { takeVector } from '../../ml/matrix';
import { classificationMetrics, regressionMetrics, type MetricSet } from '../../ml/metrics';
import { DEFAULT_PREPROCESS, encodeTarget, fitTarget, inferTask, labelledRows, transform, type TargetState } from '../../ml/preprocess';
import { holdoutSplit, kFold, type Fold } from '../../ml/split';
import { defaultParams, validateParams } from '../../models/params';
import { getPlugin } from '../../models/registry';
import type { ParamValues } from '../../models/types';
import { Rng } from '../../rng';
import { encodeBinJson } from '../../storage/binjson';
import type { AutoCandidate, AutoInput, AutoOutput, BaggedMember, TaskContext } from '../types';
import { fitOnce, meanStd } from './train';

/** Search spaces (subset of each plugin's schema, using its recommended ranges). */
const SEARCH_KEYS: Record<string, string[]> = {
  xgboost: ['maxDepth', 'learningRate', 'subsample', 'colsample', 'lambda'],
  lightgbm: ['numLeaves', 'learningRate', 'minChildSamples', 'subsample', 'colsample', 'lambda'],
  random_forest: ['maxDepth', 'minSamplesLeaf', 'maxFeatures'],
  mlp: ['hiddenLayers', 'units', 'dropout', 'learningRate'],
};

/**
 * AutoML: portfolio of strong defaults → k-fold OOF bagging (fold models are kept and averaged)
 * → TPE + asynchronous successive halving (a trial only gets all folds if its first fold is in the
 * top third) under a time budget → Caruana ensemble selection on OOF predictions → the test part
 * (if any) is evaluated exactly once at the end.
 */
export async function autoTask(input: AutoInput, ctx: TaskContext): Promise<AutoOutput> {
  const t0 = performance.now();
  const deadline = t0 + input.timeBudgetSec * 1000;
  const { table } = input;
  const rng = new Rng(input.seed);
  const task = input.task ?? inferTask(getColumn(table, input.target));
  const cls = task !== 'regression';
  const allIdx = Int32Array.from({ length: table.rowCount }, (_, i) => i);
  const classState = cls ? fitTarget(table, input.target, task, allIdx) : null;
  const yRaw = encodeTarget(classState ?? { task: 'regression', column: input.target, mean: 0, std: 1 }, table);
  const labelled = labelledRows(yRaw);
  if (labelled.length < 20) throw new Error('Too few labelled rows for Auto mode');
  const strat = cls ? takeVector(yRaw, labelled) : undefined;

  // validation strategy: ≤ 20k rows → k-fold, above → hold-out; test part carved first
  const outer = holdoutSplit(labelled.length, rng.fork('outer'), { validFraction: 0, testFraction: input.testFraction, stratify: strat });
  const dev = takeVector(labelled, outer.train);
  const test = takeVector(labelled, outer.test);
  const devStrat = cls ? takeVector(yRaw, dev) : undefined;
  const useCv = dev.length <= 20_000;
  const folds: Fold[] = useCv
    ? kFold(dev.length, input.folds ?? 5, rng.fork('folds'), devStrat)
    : (() => { const h = holdoutSplit(dev.length, rng.fork('folds'), { validFraction: 0.2, stratify: devStrat }); return [{ train: h.train, valid: h.valid }]; })();
  const oofRows = useCv ? dev : takeVector(dev, folds[0].valid);
  const oofPos = new Map<number, number>(Array.from(oofRows, (r, i) => [r, i]));
  const yOof = takeVector(yRaw, oofRows);
  const k = classState && classState.task !== 'regression' ? classState.classes.length : 1;

  const trainInput = (pluginId: string, params: ParamValues) => ({
    table,
    config: { datasetId: '', target: input.target, features: input.features, task, pluginId, params, seed: input.seed, validFraction: 0, preprocess: DEFAULT_PREPROCESS },
  });

  type Cand = AutoCandidate & { oof?: OofPrediction; testPred?: OofPrediction; member?: BaggedMember };
  const candidates: Cand[] = [];
  const lossOf = (m: MetricSet) => (cls ? m.logLoss ?? Infinity : m.rmse ?? Infinity);
  let targetState: TargetState | null = null;

  /** Evaluate one config on folds [from, to); returns false when aborted by budget. */
  async function runConfig(c: Cand, from: number, to: number): Promise<void> {
    const plugin = getPlugin(c.pluginId);
    const { params } = validateParams(plugin.params, c.params);
    c.oof ??= { data: new Float64Array(oofRows.length * k), cols: k };
    c.testPred ??= { data: new Float64Array(test.length * k), cols: k };
    c.member ??= { pluginId: c.pluginId, params, weight: 0, folds: [] };
    for (let f = from; f < to; f++) {
      const fold = folds[f];
      const tr = takeVector(dev, fold.train), va = takeVector(dev, fold.valid);
      const t1 = performance.now();
      const r = await fitOnce(table, trainInput(c.pluginId, params), plugin, params, task, classState, yRaw, tr, va, rng.fork(`${c.id}-f${f}`), ctx, () => {});
      c.fitMs += performance.now() - t1;
      targetState = r.target;
      c.foldMetrics.push(r.valid);
      const ve = r.validEval!;
      // scatter OOF predictions
      for (let i = 0; i < va.length; i++) {
        const pos = oofPos.get(va[i]);
        if (pos === undefined) continue;
        if (cls) for (let j = 0; j < k; j++) c.oof.data[pos * k + j] = ve.proba!.data[i * k + j];
        else c.oof.data[pos] = ve.pred[i];
      }
      // bagged test predictions
      if (test.length) {
        const Xte = transform(r.prep, table, test);
        const t2 = performance.now();
        if (cls) { const P = r.model.predictProba!(Xte); for (let i = 0; i < P.data.length; i++) c.testPred.data[i] += P.data[i] / folds.length; }
        else { const p = r.model.predict(Xte); const tg = r.target as Extract<TargetState, { task: 'regression' }>; for (let i = 0; i < p.length; i++) c.testPred.data[i] += (p[i] * tg.std + tg.mean) / folds.length; }
        c.predictMsPer1k = ((performance.now() - t2) / test.length) * 1000;
      }
      const artifact = await r.model.export();
      c.member.folds.push({ preprocessor: r.prep, artifact, target: r.target });
      r.model.dispose?.();
      await ctx.checkpoint();
    }
    c.foldsDone = c.foldMetrics.length;
    const ms = meanStd(c.foldMetrics);
    c.cv = ms;
    c.loss = lossOf(ms.mean);
  }

  const queue: PortfolioEntry[] = portfolio(input.preset, task, dev.length).filter((e) => getPlugin(e.pluginId).tasks.includes(task));
  const report = (msg: string) => ctx.progress({ fraction: Math.min(0.95, (performance.now() - t0) / (deadline - t0)), message: msg });
  let idx = 0;
  // 1. portfolio
  for (const e of queue) {
    if (idx > 0 && performance.now() > deadline) break;
    const c: Cand = { id: `c${idx++}`, label: e.label, pluginId: e.pluginId, params: { ...defaultParams(getPlugin(e.pluginId), task), ...e.params }, foldMetrics: [], foldsDone: 0, fitMs: 0, loss: Infinity, source: 'portfolio' };
    candidates.push(c);
    report(`${e.label}`);
    try {
      await runConfig(c, 0, folds.length);
      ctx.progress({ point: { epoch: candidates.length, loss: Math.min(...candidates.map((x) => x.loss)) } });
    } catch (err) {
      if ((err as Error).name === 'CancelledError') throw err;
      c.error = (err as Error).message;
    }
  }
  // 2. HPO: TPE proposals + asynchronous successive halving on folds
  for (const e of queue.filter((q) => q.search)) {
    const plugin = getPlugin(e.pluginId);
    const dims: SearchDim[] = (SEARCH_KEYS[e.pluginId] ?? []).map((key) => ({ key, spec: plugin.params.find((p) => p.key === key)! })).filter((d) => d.spec);
    for (let trial = 0; trial < (e.search ?? 0) && performance.now() < deadline; trial++) {
      const history = candidates.filter((c) => c.pluginId === e.pluginId && c.foldMetrics.length).map((c) => ({ params: c.params, loss: lossOf(c.foldMetrics[0]) }));
      const proposal = tpeConfig(dims, history, rng.fork(`tpe-${e.pluginId}-${trial}`));
      const c: Cand = { id: `c${idx++}`, label: `${e.label}#${trial + 1}`, pluginId: e.pluginId, params: { ...defaultParams(plugin, task), ...e.params, ...proposal }, foldMetrics: [], foldsDone: 0, fitMs: 0, loss: Infinity, source: 'search' };
      candidates.push(c);
      report(c.label);
      try {
        await runConfig(c, 0, 1);
        const rung0 = history.map((h) => h.loss).sort((a, b) => a - b);
        const cut = rung0[Math.floor(rung0.length / 3)] ?? Infinity;
        if (folds.length > 1 && lossOf(c.foldMetrics[0]) <= cut && performance.now() < deadline) await runConfig(c, 1, folds.length);
        if (c.foldsDone < folds.length) { c.loss = lossOf(c.foldMetrics[0]); c.member = undefined; c.oof = undefined; c.testPred = undefined; }
        ctx.progress({ point: { epoch: candidates.length, loss: Math.min(...candidates.filter((x) => x.foldsDone === folds.length).map((x) => x.loss)) } });
      } catch (err) {
        if ((err as Error).name === 'CancelledError') throw err;
        c.error = (err as Error).message;
      }
    }
  }

  // 3. ensemble selection on fully evaluated candidates
  ctx.progress({ fraction: 0.96, message: 'ensemble' });
  const full = candidates.filter((c) => c.foldsDone === folds.length && c.oof && !c.error).sort((a, b) => a.loss - b.loss).slice(0, 10);
  if (!full.length) throw new Error(`No model finished: ${candidates.map((c) => c.error).filter(Boolean).join('; ')}`);
  const sel = caruanaSelection(full.map((c) => c.oof!), yOof, cls, 30);
  const ensOof = blend(full.map((c) => c.oof!), sel.weights);
  const scoreOof = (p: OofPrediction, y: Float64Array): MetricSet => (cls ? classificationMetrics(y, { rows: y.length, cols: k, data: p.data }).metrics : regressionMetrics(y, p.data));
  const ensembleOof = scoreOof(ensOof, yOof);
  full.forEach((c, i) => { c.weight = sel.weights[i]; if (c.member) c.member.weight = sel.weights[i]; });

  // 4. the single test evaluation
  let ensembleTest: MetricSet | undefined;
  if (test.length) {
    const yTest = takeVector(yRaw, test);
    ensembleTest = scoreOof(blend(full.map((c) => c.testPred!), sel.weights), yTest);
    for (const c of full) c.test = scoreOof(c.testPred!, yTest);
  }
  const members = full.filter((c) => c.weight! > 0).map((c) => c.member!);
  const bundle = { kind: 'bagged-ensemble', task, target: targetState!, members };
  const bytes = encodeBinJson(bundle);
  for (const c of full) c.sizeBytes = encodeBinJson(c.member).byteLength;
  ctx.progress({ fraction: 1 });
  const strip = ({ oof: _o, testPred: _t, member: _m, ...rest }: Cand): AutoCandidate => rest;
  return {
    task,
    target: targetState!,
    validation: useCv ? { kind: 'kfold', folds: folds.length } : { kind: 'holdout', folds: 1 },
    nDev: dev.length,
    nTest: test.length,
    candidates: candidates.map(strip).sort((a, b) => a.loss - b.loss),
    ensemble: { weights: full.map((c) => ({ id: c.id, label: c.label, weight: c.weight! })), oof: ensembleOof, test: ensembleTest, lossHistory: sel.history },
    bundle: bytes,
    durationMs: performance.now() - t0,
  };
}
