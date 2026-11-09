import type { PyHandle } from '../../engines/adapters';
import { autoencoder, neuralForecast } from './neuralSeries';
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
  if (input.method === 'autoencoder') {
    const r = await autoencoder(ctx.engine('tfjs'), X, input.params, input.seed, ctx);
    return { method: 'autoencoder', ...r, featureNames: prep.outputNames, durationMs: performance.now() - t0 };
  }
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

/** Merge rows (sorted by t) that share a timestamp; returns how many rows were merged away. */
export function collapseTimestamps(rows: { t: number; y: number }[], agg: 'sum' | 'mean'): number {
  const n0 = rows.length;
  let w = -1, cnt = 0;
  for (let i = 0; i < n0; i++) {
    if (w >= 0 && rows[i].t === rows[w].t) { rows[w].y += rows[i].y; cnt++; continue; }
    if (w >= 0 && agg === 'mean' && cnt > 1) rows[w].y /= cnt;
    rows[++w] = rows[i]; cnt = 1;
  }
  if (w >= 0 && agg === 'mean' && cnt > 1) rows[w].y /= cnt;
  rows.length = w + 1;
  return n0 - rows.length;
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
  rows.sort((a, b) => a.t - b.t);
  // Several rows per timestamp (panel / transaction data) must become one observation per instant;
  // otherwise they would be read as consecutive time steps.
  const merged = collapseTimestamps(rows, input.aggregate ?? 'sum');
  if (rows.length < 12) throw new Error('Need at least 12 distinct time points');
  const freq = tc.kind === 'numeric' ? { stepMs: 1, label: 'index', seasonGuess: 0 } : detectFrequency(rows.map((r) => r.t));
  const params: Record<string, number | string> = { ...input.params, season: input.params.season ?? freq.seasonGuess };
  const y = Float64Array.from(rows, (r) => r.y);
  ctx.progress({ fraction: 0.2, message: input.method });
  const res: Pick<ForecastOutput, 'holdout' | 'forecast' | 'aic'> = input.method === 'arima' || input.method === 'ets'
    ? JSON.parse(ctx.engine<PyHandle>('pyodide').bridge.forecast(input.method, JSON.stringify(params), y, y.length, input.horizon, input.holdout))
    : await neuralForecast(ctx.engine('tfjs'), y, input.method, { ...params, window: params.window ?? (freq.seasonGuess ? 2 * freq.seasonGuess : 24) }, input.horizon, input.holdout, ctx);
  const last = rows[rows.length - 1].t;
  const fmt = (t: number) => (tc.kind === 'numeric' ? String(t) : new Date(t).toISOString().slice(0, freq.stepMs < 86400e3 ? 16 : 10));
  return {
    ...res,
    frequency: freq.label,
    merged,
    season: Number(params.season),
    history: { t: rows.map((r) => fmt(r.t)), y: Array.from(y) },
    futureT: Array.from({ length: input.horizon }, (_, i) => fmt(last + (i + 1) * freq.stepMs)),
    durationMs: performance.now() - t0,
  };
}
