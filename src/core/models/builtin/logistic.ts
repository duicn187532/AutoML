import type { Matrix } from '../../ml/matrix';
import { num } from '../params';
import type { FitContext, FitData, ModelArtifact, ModelInit, ModelPlugin, TrainedModel } from '../types';

/**
 * Multinomial logistic regression (softmax) trained with mini-batch Adam + L2,
 * early stopping on validation log-loss with best-weight restore. Pure TS reference model.
 */
interface Weights { W: Float64Array; b: Float64Array; d: number; k: number }

function softmaxRows(X: Matrix, w: Weights): Matrix {
  const { d, k, W, b } = w;
  const out = new Float64Array(X.rows * k);
  for (let i = 0; i < X.rows; i++) {
    let max = -Infinity;
    for (let c = 0; c < k; c++) {
      let z = b[c];
      for (let j = 0; j < d; j++) z += X.data[i * d + j] * W[j * k + c];
      out[i * k + c] = z;
      if (z > max) max = z;
    }
    let s = 0;
    for (let c = 0; c < k; c++) { const e = Math.exp(out[i * k + c] - max); out[i * k + c] = e; s += e; }
    for (let c = 0; c < k; c++) out[i * k + c] /= s;
  }
  return { rows: X.rows, cols: k, data: out };
}

function meanLogLoss(P: Matrix, y: Float64Array): number {
  let s = 0;
  for (let i = 0; i < y.length; i++) s -= Math.log(Math.max(1e-15, P.data[i * P.cols + y[i]]));
  return s / y.length;
}

class LogisticModel implements TrainedModel {
  w: Weights;
  constructor(private init: Omit<ModelInit, 'rng'> & { rng?: ModelInit['rng'] }, w?: Weights) {
    const d = init.nFeatures, k = init.nClasses;
    this.w = w ?? { W: new Float64Array(d * k), b: new Float64Array(k), d, k };
  }

  async fit(data: FitData, ctx: FitContext) {
    const p = this.init.params;
    const epochs = num(p, 'epochs'), lr = num(p, 'learningRate'), l2 = num(p, 'l2');
    const batch = Math.max(1, Math.min(num(p, 'batchSize'), data.X.rows));
    const patience = num(p, 'patience');
    const { d, k, W, b } = this.w;
    for (let i = 0; i < W.length; i++) W[i] = ctx.rng.normal(0, 0.01);
    const mW = new Float64Array(W.length), vW = new Float64Array(W.length);
    const mb = new Float64Array(k), vb = new Float64Array(k);
    const gW = new Float64Array(W.length), gb = new Float64Array(k);
    const prob = new Float64Array(k);
    const b1 = 0.9, b2 = 0.999, eps = 1e-8;
    let t = 0;
    const history: Record<string, number[]> = { epoch: [], loss: [], val_loss: [] };
    let best = { loss: Infinity, epoch: 0, W: W.slice(), b: b.slice() };
    let sinceBest = 0;
    const n = data.X.rows, X = data.X.data, y = data.y;

    for (let epoch = 1; epoch <= epochs; epoch++) {
      const perm = ctx.rng.permutation(n);
      for (let start = 0; start < n; start += batch) {
        const end = Math.min(n, start + batch), m = end - start;
        gW.fill(0); gb.fill(0);
        for (let r = start; r < end; r++) {
          const i = perm[r];
          let max = -Infinity;
          for (let c = 0; c < k; c++) {
            let z = b[c];
            for (let j = 0; j < d; j++) z += X[i * d + j] * W[j * k + c];
            prob[c] = z; if (z > max) max = z;
          }
          let s = 0;
          for (let c = 0; c < k; c++) { prob[c] = Math.exp(prob[c] - max); s += prob[c]; }
          for (let c = 0; c < k; c++) {
            const g = prob[c] / s - (y[i] === c ? 1 : 0);
            gb[c] += g;
            for (let j = 0; j < d; j++) gW[j * k + c] += g * X[i * d + j];
          }
        }
        t++;
        const c1 = 1 - b1 ** t, c2 = 1 - b2 ** t;
        for (let q = 0; q < W.length; q++) {
          const g = gW[q] / m + l2 * W[q];
          mW[q] = b1 * mW[q] + (1 - b1) * g; vW[q] = b2 * vW[q] + (1 - b2) * g * g;
          W[q] -= (lr * (mW[q] / c1)) / (Math.sqrt(vW[q] / c2) + eps);
        }
        for (let c = 0; c < k; c++) {
          const g = gb[c] / m;
          mb[c] = b1 * mb[c] + (1 - b1) * g; vb[c] = b2 * vb[c] + (1 - b2) * g * g;
          b[c] -= (lr * (mb[c] / c1)) / (Math.sqrt(vb[c] / c2) + eps);
        }
      }
      const loss = meanLogLoss(softmaxRows(data.X, this.w), y);
      const vloss = data.valid ? meanLogLoss(softmaxRows(data.valid.X, this.w), data.valid.y) : loss;
      history.epoch.push(epoch); history.loss.push(loss); history.val_loss.push(vloss);
      ctx.progress({ fraction: epoch / epochs, point: { epoch, loss, val_loss: vloss } });
      if (vloss < best.loss - 1e-6) { best = { loss: vloss, epoch, W: W.slice(), b: b.slice() }; sinceBest = 0; }
      else if (patience > 0 && ++sinceBest >= patience) break;
      await ctx.checkpoint();
    }
    W.set(best.W); b.set(best.b);
    return { history, bestEpoch: best.epoch, epochs: history.epoch.length };
  }

  predictProba(X: Matrix) { return softmaxRows(X, this.w); }

  predict(X: Matrix) {
    const P = this.predictProba(X);
    const out = new Float64Array(X.rows);
    for (let i = 0; i < X.rows; i++) {
      let best = 0;
      for (let c = 1; c < P.cols; c++) if (P.data[i * P.cols + c] > P.data[i * P.cols + best]) best = c;
      out[i] = best;
    }
    return out;
  }

  async export(): Promise<ModelArtifact> {
    return {
      pluginId: 'logistic', pluginVersion: 1, task: this.init.task, nFeatures: this.w.d, nClasses: this.w.k,
      params: this.init.params, payload: { W: Array.from(this.w.W), b: Array.from(this.w.b) },
    };
  }
}

export const logisticPlugin: ModelPlugin = {
  id: 'logistic',
  version: 1,
  name: { 'zh-TW': '邏輯回歸', en: 'Logistic regression' },
  description: {
    'zh-TW': '線性分類基準模型（softmax + L2）。速度快、可解釋，適合當第一個 baseline。',
    en: 'Linear classification baseline (softmax + L2). Fast and interpretable — a good first baseline.',
  },
  family: 'linear',
  tasks: ['binary', 'multiclass'],
  engines: [],
  params: [
    { key: 'learningRate', type: 'float', default: 0.05, min: 1e-5, max: 1, log: true, recommended: [0.005, 0.1],
      label: { 'zh-TW': '學習率', en: 'Learning rate' }, help: { 'zh-TW': 'Adam 步長；太大會震盪、太小收斂慢。', en: 'Adam step size; too large oscillates, too small converges slowly.' } },
    { key: 'l2', type: 'float', default: 1e-4, min: 0, max: 1, log: true, recommended: [1e-5, 1e-2],
      label: { 'zh-TW': 'L2 正則化', en: 'L2 penalty' }, help: { 'zh-TW': '越大權重越小、越不易過擬合。', en: 'Larger shrinks weights and reduces overfitting.' } },
    { key: 'epochs', type: 'int', default: 100, min: 1, max: 5000, recommended: [50, 300],
      label: { 'zh-TW': '訓練輪數', en: 'Epochs' } },
    { key: 'batchSize', type: 'int', default: 64, min: 1, max: 65536, recommended: [32, 256],
      label: { 'zh-TW': '批次大小', en: 'Batch size' } },
    { key: 'patience', type: 'int', default: 10, min: 0, max: 1000, recommended: [5, 20],
      label: { 'zh-TW': 'Early stopping 耐心值', en: 'Early-stopping patience' }, help: { 'zh-TW': '驗證 loss 連續幾輪未改善就停止並還原最佳權重；0 = 不啟用。', en: 'Stop after this many epochs without validation improvement and restore best weights; 0 = off.' } },
  ],
  create: (init) => new LogisticModel(init),
  async load(a, init) {
    const p = a.payload as { W: number[]; b: number[] };
    return new LogisticModel({ ...init, params: a.params }, { W: Float64Array.from(p.W), b: Float64Array.from(p.b), d: a.nFeatures, k: a.nClasses });
  },
};
