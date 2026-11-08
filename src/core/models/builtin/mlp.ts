import type * as TF from '@tensorflow/tfjs';
import type { Matrix } from '../../ml/matrix';
import { num, str } from '../params';
import type { FitContext, FitData, ModelArtifact, ModelInit, ModelPlugin, TrainedModel } from '../types';
import { base64ToBytes, bytesToBase64 } from '../../util/base64';

/**
 * Multi-layer perceptron on TF.js (loaded as an engine pack inside the worker).
 * Reproducibility: seeded initialisers/dropout and our own seeded shuffling (tf's shuffle uses Math.random).
 */
type Tf = typeof TF;

function build(tf: Tf, init: Omit<ModelInit, 'rng' | 'engine'>, seed: number): TF.Sequential {
  const p = init.params;
  const layers = num(p, 'hiddenLayers'), units = num(p, 'units'), dropout = num(p, 'dropout'), l2 = num(p, 'l2');
  const act = str(p, 'activation') as 'relu' | 'gelu' | 'tanh' | 'elu';
  const model = tf.sequential();
  for (let i = 0; i < layers; i++) {
    const u = Math.max(4, Math.round(units / 2 ** i));
    model.add(tf.layers.dense({
      units: u,
      inputShape: i === 0 ? [init.nFeatures] : undefined,
      activation: act === 'gelu' ? 'linear' : act,
      kernelInitializer: tf.initializers.heNormal({ seed: seed + i }),
      kernelRegularizer: l2 > 0 ? tf.regularizers.l2({ l2 }) : undefined,
    }));
    if (act === 'gelu') model.add(tf.layers.activation({ activation: 'gelu' as never }));
    if (dropout > 0) model.add(tf.layers.dropout({ rate: dropout, seed: seed + 100 + i }));
  }
  const cls = init.task !== 'regression';
  model.add(tf.layers.dense({
    units: cls ? init.nClasses : 1,
    activation: cls ? 'softmax' : 'linear',
    inputShape: layers === 0 ? [init.nFeatures] : undefined,
    kernelInitializer: tf.initializers.glorotUniform({ seed: seed + 999 }),
  }));
  model.compile({
    optimizer: tf.train.adam(num(p, 'learningRate')),
    loss: cls ? 'sparseCategoricalCrossentropy' : 'meanSquaredError',
  });
  return model;
}

class MlpModel implements TrainedModel {
  private tf: Tf;
  model: TF.Sequential | TF.LayersModel | null;
  constructor(private init: Omit<ModelInit, 'rng'>, model?: TF.LayersModel, seed = 0) {
    this.tf = init.engine<Tf>('tfjs');
    this.model = model ?? build(this.tf, init, seed);
  }

  private tensor(X: Matrix) {
    return this.tf.tensor2d(Float32Array.from(X.data), [X.rows, X.cols]);
  }

  async fit(data: FitData, ctx: FitContext) {
    const tf = this.tf, model = this.model!;
    const epochs = num(this.init.params, 'epochs'), batchSize = num(this.init.params, 'batchSize');
    const patience = num(this.init.params, 'patience');
    const cls = this.init.task !== 'regression';
    const backend = str(this.init.params, 'backend');
    if (backend && tf.getBackend() !== backend && !(await tf.setBackend(backend))) throw new Error(`TF.js backend "${backend}" unavailable`);
    const n = data.X.rows;
    const yArr = Float32Array.from(data.y);
    const xAll = this.tensor(data.X);
    const yAll = cls ? tf.tensor1d(yArr) : tf.tensor2d(yArr, [n, 1]);
    const xv = data.valid ? this.tensor(data.valid.X) : null;
    const yv = data.valid ? (cls ? tf.tensor1d(Float32Array.from(data.valid.y)) : tf.tensor2d(Float32Array.from(data.valid.y), [data.valid.y.length, 1])) : null;
    const history: Record<string, number[]> = { epoch: [], loss: [], val_loss: [] };
    let best = { loss: Infinity, epoch: 0, weights: [] as TF.Tensor[] };
    let since = 0;
    try {
      for (let epoch = 1; epoch <= epochs; epoch++) {
        const perm = tf.tensor1d(ctx.rng.permutation(n), 'int32');
        const xs = tf.gather(xAll, perm), ys = tf.gather(yAll, perm);
        const h = await model.fit(xs, ys, { epochs: 1, batchSize, shuffle: false, verbose: 0 });
        tf.dispose([perm, xs, ys]);
        const loss = Number(h.history.loss[0]);
        let vloss = loss;
        if (xv && yv) {
          const ev = model.evaluate(xv, yv, { batchSize: 1024 }) as TF.Scalar;
          vloss = (await ev.data())[0];
          ev.dispose();
        }
        history.epoch.push(epoch); history.loss.push(loss); history.val_loss.push(vloss);
        ctx.progress({ fraction: epoch / epochs, point: { epoch, loss, val_loss: vloss } });
        if (vloss < best.loss - 1e-7) {
          tf.dispose(best.weights);
          best = { loss: vloss, epoch, weights: model.getWeights().map((w) => w.clone()) };
          since = 0;
        } else if (patience > 0 && ++since >= patience) break;
        await ctx.checkpoint();
      }
      if (best.weights.length) model.setWeights(best.weights);
    } finally {
      tf.dispose([xAll, yAll, ...(xv ? [xv] : []), ...(yv ? [yv] : []), ...best.weights]);
    }
    return { history, bestEpoch: best.epoch, epochs: history.epoch.length, notes: [`tf backend: ${tf.getBackend()}`] };
  }

  private run(X: Matrix): Float32Array {
    const tf = this.tf;
    return tf.tidy(() => (this.model!.predict(this.tensor(X), { batchSize: 1024 }) as TF.Tensor).dataSync() as Float32Array);
  }

  predict(X: Matrix) {
    const out = this.run(X);
    if (this.init.task === 'regression') return Float64Array.from(out);
    const k = this.init.nClasses, pred = new Float64Array(X.rows);
    for (let i = 0; i < X.rows; i++) {
      let b = 0;
      for (let c = 1; c < k; c++) if (out[i * k + c] > out[i * k + b]) b = c;
      pred[i] = b;
    }
    return pred;
  }

  predictProba(X: Matrix): Matrix {
    if (this.init.task === 'regression') throw new Error('predictProba on a regressor');
    return { rows: X.rows, cols: this.init.nClasses, data: Float64Array.from(this.run(X)) };
  }

  async export(): Promise<ModelArtifact> {
    const tf = this.tf;
    let saved: TF.io.ModelArtifacts | null = null;
    await this.model!.save(tf.io.withSaveHandler(async (a) => { saved = a; return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } }; }));
    const a = saved! as TF.io.ModelArtifacts;
    const weightData = a.weightData instanceof ArrayBuffer ? new Uint8Array(a.weightData) : new Uint8Array(tf.io.concatenateArrayBuffers(a.weightData as ArrayBuffer[]));
    return {
      pluginId: 'mlp', pluginVersion: 1, task: this.init.task, nFeatures: this.init.nFeatures, nClasses: this.init.nClasses,
      params: this.init.params,
      payload: { modelTopology: a.modelTopology, weightSpecs: a.weightSpecs, format: 'tfjs-layers', weightsBase64: bytesToBase64(weightData) },
    };
  }

  dispose() { this.model?.dispose(); this.model = null; }
}

export const mlpPlugin: ModelPlugin = {
  id: 'mlp',
  version: 1,
  name: { 'zh-TW': 'MLP 神經網路', en: 'MLP neural network' },
  description: {
    'zh-TW': '多層感知器（TF.js，自動使用 WebGL/WebGPU 或 CPU）。每層單元數依序減半，含 dropout 與 early stopping。',
    en: 'Multi-layer perceptron (TF.js; WebGL/WebGPU or CPU). Units halve per layer; dropout and early stopping.',
  },
  family: 'neural',
  tasks: ['binary', 'multiclass', 'regression'],
  engines: ['tfjs'],
  params: [
    { key: 'hiddenLayers', type: 'int', default: 2, min: 0, max: 6, recommended: [1, 3], label: { 'zh-TW': '隱藏層數', en: 'Hidden layers' } },
    { key: 'units', type: 'int', default: 64, min: 4, max: 1024, log: true, recommended: [32, 256], label: { 'zh-TW': '第一層單元數', en: 'Units (first layer)' } },
    { key: 'activation', type: 'enum', default: 'relu', label: { 'zh-TW': '激活函數', en: 'Activation' },
      options: [
        { value: 'relu', label: { 'zh-TW': 'ReLU', en: 'ReLU' } },
        { value: 'elu', label: { 'zh-TW': 'ELU', en: 'ELU' } },
        { value: 'tanh', label: { 'zh-TW': 'tanh', en: 'tanh' } },
      ] },
    { key: 'dropout', type: 'float', default: 0.1, min: 0, max: 0.8, step: 0.05, recommended: [0, 0.3], label: { 'zh-TW': 'Dropout', en: 'Dropout' } },
    { key: 'l2', type: 'float', default: 0, min: 0, max: 0.1, log: true, recommended: [0, 1e-3], label: { 'zh-TW': 'L2 正則化', en: 'L2 penalty' } },
    { key: 'learningRate', type: 'float', default: 0.003, min: 1e-5, max: 0.1, log: true, recommended: [3e-4, 1e-2], label: { 'zh-TW': '學習率', en: 'Learning rate' } },
    { key: 'epochs', type: 'int', default: 100, min: 1, max: 2000, recommended: [50, 300], label: { 'zh-TW': '訓練輪數', en: 'Epochs' } },
    { key: 'batchSize', type: 'int', default: 64, min: 8, max: 4096, recommended: [32, 256], label: { 'zh-TW': '批次大小', en: 'Batch size' } },
    { key: 'patience', type: 'int', default: 10, min: 0, max: 500, recommended: [5, 20], label: { 'zh-TW': 'Early stopping 耐心值', en: 'Early-stopping patience' } },
    { key: 'backend', type: 'enum', default: 'cpu', label: { 'zh-TW': '運算後端', en: 'Compute backend' },
      help: { 'zh-TW': 'M0 實測：小型表格 MLP 用 CPU 比 WebGL 快；大模型再改 WebGL。', en: 'M0 benchmark: CPU beats WebGL for small tabular MLPs; use WebGL for large models.' },
      options: [{ value: 'cpu', label: { 'zh-TW': 'CPU', en: 'CPU' } }, { value: 'webgl', label: { 'zh-TW': 'WebGL（GPU）', en: 'WebGL (GPU)' } }] },
  ],
  create: (init) => new MlpModel(init, undefined, init.rng.nextU32() % 1_000_000),
  async load(a, init) {
    const tf = init.engine<Tf>('tfjs');
    const p = a.payload as { modelTopology: TF.io.ModelArtifacts['modelTopology']; weightSpecs: TF.io.WeightsManifestEntry[]; weightsBase64: string };
    const bytes = base64ToBytes(p.weightsBase64);
    const model = await tf.loadLayersModel(tf.io.fromMemory({ modelTopology: p.modelTopology, weightSpecs: p.weightSpecs, weightData: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer }));
    return new MlpModel({ ...init, params: a.params }, model);
  },
};
