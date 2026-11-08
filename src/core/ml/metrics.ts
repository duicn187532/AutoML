import type { Matrix } from './matrix';

/* ---------- classification ---------- */

export function accuracy(yTrue: ArrayLike<number>, yPred: ArrayLike<number>): number {
  let ok = 0;
  for (let i = 0; i < yTrue.length; i++) if (yTrue[i] === yPred[i]) ok++;
  return yTrue.length ? ok / yTrue.length : NaN;
}

/** Confusion matrix [true][pred]. */
export function confusionMatrix(yTrue: ArrayLike<number>, yPred: ArrayLike<number>, nClasses: number): number[][] {
  const m = Array.from({ length: nClasses }, () => new Array<number>(nClasses).fill(0));
  for (let i = 0; i < yTrue.length; i++) m[yTrue[i]][yPred[i]]++;
  return m;
}

export interface PerClass {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export function perClassReport(cm: number[][]): PerClass[] {
  const k = cm.length;
  return cm.map((row, c) => {
    const tp = row[c];
    const support = row.reduce((a, b) => a + b, 0);
    let predicted = 0;
    for (let r = 0; r < k; r++) predicted += cm[r][c];
    const precision = predicted ? tp / predicted : 0;
    const recall = support ? tp / support : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { precision, recall, f1, support };
  });
}

export function macroF1(cm: number[][]): number {
  const r = perClassReport(cm).filter((c) => c.support > 0);
  return r.length ? r.reduce((a, c) => a + c.f1, 0) / r.length : NaN;
}

/** Multiclass log loss; proba rows are clipped to [eps, 1-eps] and renormalised. */
export function logLoss(yTrue: ArrayLike<number>, proba: Matrix, eps = 1e-15): number {
  let s = 0;
  for (let i = 0; i < yTrue.length; i++) {
    let rowSum = 0;
    for (let j = 0; j < proba.cols; j++) rowSum += Math.min(1 - eps, Math.max(eps, proba.data[i * proba.cols + j]));
    const p = Math.min(1 - eps, Math.max(eps, proba.data[i * proba.cols + yTrue[i]])) / rowSum;
    s -= Math.log(p);
  }
  return s / yTrue.length;
}

/**
 * Binary ROC AUC via the rank statistic (Mann–Whitney U) with average ranks for ties.
 * Equivalent to sklearn.metrics.roc_auc_score. Returns NaN when only one class is present.
 * (Legacy implementation missed the (0,0) point and mishandled ties.)
 */
export function rocAuc(yTrue: ArrayLike<number>, score: ArrayLike<number>): number {
  const n = yTrue.length;
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => score[a] - score[b]);
  let nPos = 0;
  for (let i = 0; i < n; i++) if (yTrue[i] === 1) nPos++;
  const nNeg = n - nPos;
  if (nPos === 0 || nNeg === 0) return NaN;
  let rankSumPos = 0;
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && score[idx[j + 1]] === score[idx[i]]) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let t = i; t <= j; t++) if (yTrue[idx[t]] === 1) rankSumPos += avgRank;
    i = j + 1;
  }
  return (rankSumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

/** ROC curve points (fpr, tpr, thresholds), starting at (0,0) — same convention as sklearn (drop_intermediate=false). */
export function rocCurve(yTrue: ArrayLike<number>, score: ArrayLike<number>): { fpr: number[]; tpr: number[]; thresholds: number[] } {
  const n = yTrue.length;
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => score[b] - score[a]);
  let P = 0;
  for (let i = 0; i < n; i++) if (yTrue[i] === 1) P++;
  const N = n - P;
  const fpr = [0], tpr = [0], thresholds = [Infinity];
  let tp = 0, fp = 0;
  for (let i = 0; i < n; i++) {
    if (yTrue[idx[i]] === 1) tp++; else fp++;
    if (i === n - 1 || score[idx[i + 1]] !== score[idx[i]]) {
      fpr.push(N ? fp / N : 0);
      tpr.push(P ? tp / P : 0);
      thresholds.push(score[idx[i]]);
    }
  }
  return { fpr, tpr, thresholds };
}

/** Macro one-vs-rest AUC for multiclass probabilities (sklearn multi_class='ovr', average='macro'). */
export function rocAucOvr(yTrue: ArrayLike<number>, proba: Matrix): number {
  const aucs: number[] = [];
  for (let c = 0; c < proba.cols; c++) {
    const yb = new Int32Array(yTrue.length);
    const sc = new Float64Array(yTrue.length);
    for (let i = 0; i < yTrue.length; i++) {
      yb[i] = yTrue[i] === c ? 1 : 0;
      sc[i] = proba.data[i * proba.cols + c];
    }
    const a = rocAuc(yb, sc);
    if (!Number.isNaN(a)) aucs.push(a);
  }
  return aucs.length ? aucs.reduce((a, b) => a + b, 0) / aucs.length : NaN;
}

/* ---------- regression ---------- */

export function mae(y: ArrayLike<number>, p: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < y.length; i++) s += Math.abs(y[i] - p[i]);
  return s / y.length;
}

export function rmse(y: ArrayLike<number>, p: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < y.length; i++) s += (y[i] - p[i]) ** 2;
  return Math.sqrt(s / y.length);
}

export function r2(y: ArrayLike<number>, p: ArrayLike<number>): number {
  let mean = 0;
  for (let i = 0; i < y.length; i++) mean += y[i];
  mean /= y.length;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < y.length; i++) {
    ssRes += (y[i] - p[i]) ** 2;
    ssTot += (y[i] - mean) ** 2;
  }
  return ssTot === 0 ? (ssRes === 0 ? 1 : 0) : 1 - ssRes / ssTot;
}

/** MAPE as a fraction (sklearn convention, eps-guarded denominator). */
export function mape(y: ArrayLike<number>, p: ArrayLike<number>): number {
  const eps = 2.220446049250313e-16;
  let s = 0;
  for (let i = 0; i < y.length; i++) s += Math.abs(y[i] - p[i]) / Math.max(Math.abs(y[i]), eps);
  return s / y.length;
}

/* ---------- summaries ---------- */

export type MetricName = 'accuracy' | 'logLoss' | 'auc' | 'macroF1' | 'mae' | 'rmse' | 'r2' | 'mape';
export type MetricSet = Partial<Record<MetricName, number>>;

/** Whether larger is better (used for sorting leaderboards). */
export const METRIC_HIGHER_IS_BETTER: Record<MetricName, boolean> = {
  accuracy: true, logLoss: false, auc: true, macroF1: true, mae: false, rmse: false, r2: true, mape: false,
};

export function classificationMetrics(yTrue: ArrayLike<number>, proba: Matrix): { metrics: MetricSet; confusion: number[][]; pred: Int32Array } {
  const k = proba.cols;
  const pred = new Int32Array(yTrue.length);
  for (let i = 0; i < yTrue.length; i++) {
    let best = 0;
    for (let j = 1; j < k; j++) if (proba.data[i * k + j] > proba.data[i * k + best]) best = j;
    pred[i] = best;
  }
  const confusion = confusionMatrix(yTrue, pred, k);
  let auc: number;
  if (k === 2) {
    const s = new Float64Array(yTrue.length);
    for (let i = 0; i < yTrue.length; i++) s[i] = proba.data[i * 2 + 1];
    auc = rocAuc(yTrue, s);
  } else auc = rocAucOvr(yTrue, proba);
  return {
    metrics: { accuracy: accuracy(yTrue, pred), logLoss: logLoss(yTrue, proba), auc, macroF1: macroF1(confusion) },
    confusion,
    pred,
  };
}

export function regressionMetrics(y: ArrayLike<number>, p: ArrayLike<number>): MetricSet {
  return { mae: mae(y, p), rmse: rmse(y, p), r2: r2(y, p), mape: mape(y, p) };
}
