import type { PyHandle } from '../../engines/adapters';
import { cellString, getColumn } from '../../data/table';
import { DEFAULT_PREPROCESS, fitPreprocessor, transform } from '../../ml/preprocess';
import type { ForecastInput, ForecastOutput, TaskContext, UnsupervisedInput, UnsupervisedOutput } from '../types';

/** Clustering / dimensionality reduction / anomaly detection (scikit-learn in Pyodide). */
export async function unsupervisedTask(input: UnsupervisedInput, ctx: TaskContext): Promise<UnsupervisedOutput> {
  const t0 = performance.now();
  const all = Int32Array.from({ length: input.table.rowCount }, (_, i) => i);
  // no target → nothing to leak; scaling matters for distance-based methods
  const prep = fitPreprocessor(input.table, input.features, all, { ...DEFAULT_PREPROCESS, missingIndicators: false });
  const X = transform(prep, input.table, all);
  ctx.progress({ fraction: 0.2, message: input.method });
  const h = ctx.engine<PyHandle>('pyodide');
  const out = JSON.parse(h.bridge.unsupervised(input.method, JSON.stringify(input.params), X.data, X.rows, X.cols, input.seed)) as Omit<UnsupervisedOutput, 'durationMs' | 'featureNames'>;
  ctx.progress({ fraction: 1 });
  return { ...out, featureNames: prep.outputNames, durationMs: performance.now() - t0 };
}

const STEPS: [number, string][] = [[3600e3, 'hourly'], [86400e3, 'daily'], [7 * 86400e3, 'weekly'], [30.44 * 86400e3, 'monthly'], [91.3 * 86400e3, 'quarterly'], [365.25 * 86400e3, 'yearly']];

/** Detect the sampling frequency from the median gap between timestamps. */
export function detectFrequency(ms: number[]): { stepMs: number; label: string; seasonGuess: number } {
  const gaps = ms.slice(1).map((v, i) => v - ms[i]).filter((g) => g > 0).sort((a, b) => a - b);
  const med = gaps[gaps.length >> 1] ?? 86400e3;
  let best = STEPS[0];
  for (const s of STEPS) if (Math.abs(Math.log(med / s[0])) < Math.abs(Math.log(med / best[0]))) best = s;
  const season = { hourly: 24, daily: 7, weekly: 52, monthly: 12, quarterly: 4, yearly: 0 }[best[1]] ?? 0;
  return { stepMs: med, label: best[1], seasonGuess: season };
}

/** ARIMA / ETS forecasting of one series ordered by a time column (statsmodels in Pyodide). */
export async function forecastTask(input: ForecastInput, ctx: TaskContext): Promise<ForecastOutput> {
  const t0 = performance.now();
  const tc = getColumn(input.table, input.timeColumn), vc = getColumn(input.table, input.valueColumn);
  if (vc.kind !== 'numeric') throw new Error('Value column must be numeric');
  const rows: { t: number; label: string; y: number }[] = [];
  for (let i = 0; i < input.table.rowCount; i++) {
    const s = cellString(tc, i), y = vc.values[i];
    const t = tc.kind === 'numeric' ? tc.values[i] : s === null ? NaN : Date.parse(s.replace(/\//g, '-'));
    if (!Number.isNaN(t) && !Number.isNaN(y)) rows.push({ t, label: s ?? String(t), y });
  }
  if (rows.length < 12) throw new Error('Need at least 12 observations');
  rows.sort((a, b) => a.t - b.t);
  const freq = tc.kind === 'numeric' ? { stepMs: 1, label: 'index', seasonGuess: 0 } : detectFrequency(rows.map((r) => r.t));
  const params = { ...input.params, season: input.params.season ?? freq.seasonGuess };
  const y = Float64Array.from(rows, (r) => r.y);
  ctx.progress({ fraction: 0.2, message: input.method });
  const h = ctx.engine<PyHandle>('pyodide');
  const res = JSON.parse(h.bridge.forecast(input.method, JSON.stringify(params), y, y.length, input.horizon, input.holdout)) as Pick<ForecastOutput, 'holdout' | 'forecast' | 'aic'>;
  const last = rows[rows.length - 1].t;
  const fmt = (t: number) => (tc.kind === 'numeric' ? String(t) : new Date(t).toISOString().slice(0, freq.stepMs < 86400e3 ? 16 : 10));
  return {
    ...res,
    frequency: freq.label,
    season: Number(params.season),
    history: { t: rows.map((r) => fmt(r.t)), y: Array.from(y) },
    futureT: Array.from({ length: input.horizon }, (_, i) => fmt(last + (i + 1) * freq.stepMs)),
    durationMs: performance.now() - t0,
  };
}
