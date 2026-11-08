import type { MetricName } from '@/core/ml/metrics';

export function fmtMetric(name: MetricName, v: number | undefined): string {
  if (v === undefined || Number.isNaN(v)) return '—';
  if (name === 'accuracy' || name === 'mape') return `${(v * 100).toFixed(2)}%`;
  if (Math.abs(v) >= 1e4) return v.toExponential(3);
  return v.toFixed(4);
}

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

export function fmtNum(v: number | undefined, digits = 3): string {
  if (v === undefined || Number.isNaN(v)) return '—';
  if (Number.isInteger(v)) return v.toLocaleString();
  return Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(2) : v.toFixed(digits);
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export const CLASSIFICATION_METRICS: MetricName[] = ['accuracy', 'auc', 'macroF1', 'logLoss'];
export const REGRESSION_METRICS: MetricName[] = ['rmse', 'mae', 'r2', 'mape'];
