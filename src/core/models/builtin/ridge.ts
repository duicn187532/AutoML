import type { Matrix } from '../../ml/matrix';
import { num } from '../params';
import type { FitContext, FitData, ModelArtifact, ModelInit, ModelPlugin, TrainedModel } from '../types';

/** Solve (A) x = b for symmetric positive-definite A (n×n, row-major) via Cholesky. */
export function choleskySolve(A: Float64Array, bvec: Float64Array, n: number): Float64Array {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i * n + j];
      for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
      if (i === j) {
        if (s <= 0) throw new Error('Matrix is not positive definite (increase alpha)');
        L[i * n + i] = Math.sqrt(s);
      } else L[i * n + j] = s / L[j * n + j];
    }
  }
  const z = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = bvec[i];
    for (let k = 0; k < i; k++) s -= L[i * n + k] * z[k];
    z[i] = s / L[i * n + i];
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = z[i];
    for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k];
    x[i] = s / L[i * n + i];
  }
  return x;
}

/** Ridge regression, closed form with unpenalised intercept: minimises ||y - Xw - b||² + alpha·||w||². */
class RidgeModel implements TrainedModel {
  constructor(private init: Omit<ModelInit, 'rng'>, public w: Float64Array = new Float64Array(init.nFeatures), public b = 0) {}

  async fit(data: FitData, ctx: FitContext) {
    const alpha = num(this.init.params, 'alpha');
    const { rows: n, cols: d, data: X } = data.X;
    const y = data.y;
    const xm = new Float64Array(d);
    let ym = 0;
    for (let i = 0; i < n; i++) { ym += y[i]; for (let j = 0; j < d; j++) xm[j] += X[i * d + j]; }
    ym /= n; for (let j = 0; j < d; j++) xm[j] /= n;
    const A = new Float64Array(d * d), rhs = new Float64Array(d);
    for (let i = 0; i < n; i++) {
      const yi = y[i] - ym;
      for (let j = 0; j < d; j++) {
        const xj = X[i * d + j] - xm[j];
        rhs[j] += xj * yi;
        for (let k = 0; k <= j; k++) A[j * d + k] += xj * (X[i * d + k] - xm[k]);
      }
      if (i % 2000 === 0) { ctx.progress({ fraction: 0.9 * (i / n) }); await ctx.checkpoint(); }
    }
    for (let j = 0; j < d; j++) { for (let k = 0; k < j; k++) A[k * d + j] = A[j * d + k]; A[j * d + j] += alpha + 1e-8; }
    this.w = choleskySolve(A, rhs, d);
    let dot = 0;
    for (let j = 0; j < d; j++) dot += xm[j] * this.w[j];
    this.b = ym - dot;
    const mse = (M: Matrix, t: Float64Array) => { const p = this.predict(M); let s = 0; for (let i = 0; i < t.length; i++) s += (t[i] - p[i]) ** 2; return s / t.length; };
    const loss = mse(data.X, y);
    const val = data.valid ? mse(data.valid.X, data.valid.y) : loss;
    ctx.progress({ fraction: 1, point: { epoch: 1, loss, val_loss: val } });
    return { history: { epoch: [1], loss: [loss], val_loss: [val] }, epochs: 1 };
  }

  predict(X: Matrix) {
    const out = new Float64Array(X.rows);
    for (let i = 0; i < X.rows; i++) {
      let s = this.b;
      for (let j = 0; j < X.cols; j++) s += X.data[i * X.cols + j] * this.w[j];
      out[i] = s;
    }
    return out;
  }

  async export(): Promise<ModelArtifact> {
    return { pluginId: 'ridge', pluginVersion: 1, task: 'regression', nFeatures: this.w.length, nClasses: 0, params: this.init.params, payload: { w: Array.from(this.w), b: this.b } };
  }
}

export const ridgePlugin: ModelPlugin = {
  id: 'ridge',
  version: 1,
  name: { 'zh-TW': 'Ridge 線性迴歸', en: 'Ridge regression' },
  description: {
    'zh-TW': '加 L2 正則化的線性迴歸（解析解）。alpha=0 即一般最小平方法。',
    en: 'Linear regression with an L2 penalty (closed form). alpha = 0 is ordinary least squares.',
  },
  family: 'linear',
  tasks: ['regression'],
  engines: [],
  params: [
    { key: 'alpha', type: 'float', default: 1, min: 0, max: 1e6, log: true, recommended: [0.01, 100],
      label: { 'zh-TW': 'alpha（正則化強度）', en: 'alpha (penalty)' }, help: { 'zh-TW': '特徵已標準化；共線性高時調大。', en: 'Features are standardised; increase under collinearity.' } },
  ],
  create: (init) => new RidgeModel(init),
  async load(a, init) {
    const p = a.payload as { w: number[]; b: number };
    return new RidgeModel({ ...init, params: a.params }, Float64Array.from(p.w), p.b);
  },
};
