import { inferTask, type TaskKind } from '../ml/preprocess';
import { Rng } from '../rng';
import { cellString, getColumn, profileColumn, type Column, type ColumnProfile, type ColumnarTable } from './table';

/**
 * Data understanding: quality report, target-leakage screen, distributions, correlations and
 * feature↔target relations. Runs in a worker on the full table.
 */
export type QualityStatus = 'pass' | 'auto' | 'warn';
export type QualityCheck = 'missing' | 'constant' | 'idLike' | 'highCardinality' | 'textColumn' | 'imbalance' | 'duplicates' | 'outliers' | 'leakage';

export interface QualityIssue {
  check: QualityCheck;
  status: QualityStatus;
  column?: string;
  /** Main number for the message (ratio, count, score…). */
  value?: number;
  extra?: string;
}

export interface Histogram {
  kind: 'numeric' | 'categorical';
  /** numeric: bin edges (length bins+1); categorical: labels */
  labels: (string | number)[];
  counts: number[];
  missing: number;
}

export interface TargetRelation {
  feature: string;
  /** |Pearson r|, correlation ratio η, or Cramér's V depending on kinds. */
  assoc: number;
  assocKind: 'pearson' | 'eta' | 'cramersV';
  /** Hold-out predictive power of the single feature (0 = none, 1 = perfect). */
  score: number;
}

export interface DataProfile {
  rowCount: number;
  columns: ColumnProfile[];
  quality: QualityIssue[];
  histograms: Record<string, Histogram>;
  correlation: { columns: string[]; matrix: number[][] };
  target?: { column: string; task: TaskKind; classes?: { label: string; count: number }[]; relations: TargetRelation[] };
}

export const LEAKAGE_THRESHOLD = 0.98;

/* ---------- histograms ---------- */

export function histogram(col: Column, bins = 30, topK = 20): Histogram {
  if (col.kind === 'numeric') {
    let min = Infinity, max = -Infinity, missing = 0;
    for (const v of col.values) { if (Number.isNaN(v)) { missing++; continue; } if (v < min) min = v; if (v > max) max = v; }
    if (min === Infinity) return { kind: 'numeric', labels: [], counts: [], missing };
    const b = min === max ? 1 : bins;
    const width = (max - min) / b || 1;
    const counts = new Array<number>(b).fill(0);
    for (const v of col.values) if (!Number.isNaN(v)) counts[Math.min(b - 1, Math.floor((v - min) / width))]++;
    return { kind: 'numeric', labels: Array.from({ length: b + 1 }, (_, i) => min + i * width), counts, missing };
  }
  const p = profileColumn(col, topK);
  const shown = (p.top ?? []).reduce((a, x) => a + x.count, 0);
  const rest = col.values.length - p.missing - shown;
  return {
    kind: 'categorical',
    labels: [...(p.top ?? []).map((x) => x.value), ...(rest > 0 ? ['(other)'] : [])],
    counts: [...(p.top ?? []).map((x) => x.count), ...(rest > 0 ? [rest] : [])],
    missing: p.missing,
  };
}

/* ---------- associations ---------- */

export function pearson(x: Float64Array, y: Float64Array): number {
  let n = 0, mx = 0, my = 0;
  for (let i = 0; i < x.length; i++) if (!Number.isNaN(x[i]) && !Number.isNaN(y[i])) { n++; mx += x[i]; my += y[i]; }
  if (n < 3) return 0;
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    if (Number.isNaN(x[i]) || Number.isNaN(y[i])) continue;
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}

function codes(col: Column, maxLevels = 200): Int32Array {
  const map = new Map<string, number>();
  const out = new Int32Array(col.values.length);
  for (let i = 0; i < out.length; i++) {
    const s = cellString(col, i);
    if (s === null) { out[i] = -1; continue; }
    let c = map.get(s);
    if (c === undefined) { c = map.size < maxLevels ? map.size : maxLevels; if (map.size < maxLevels) map.set(s, c); }
    out[i] = c;
  }
  return out;
}

/** Correlation ratio η between categorical codes and numeric values. */
export function correlationRatio(cat: Int32Array, y: Float64Array): number {
  const sum = new Map<number, [number, number]>();
  let n = 0, mean = 0;
  for (let i = 0; i < y.length; i++) {
    if (cat[i] < 0 || Number.isNaN(y[i])) continue;
    n++; mean += y[i];
    const e = sum.get(cat[i]) ?? [0, 0];
    e[0] += y[i]; e[1]++;
    sum.set(cat[i], e);
  }
  if (n < 3) return 0;
  mean /= n;
  let between = 0, total = 0;
  for (const [s, c] of sum.values()) between += c * (s / c - mean) ** 2;
  for (let i = 0; i < y.length; i++) if (cat[i] >= 0 && !Number.isNaN(y[i])) total += (y[i] - mean) ** 2;
  return total > 0 ? Math.sqrt(between / total) : 0;
}

export function cramersV(a: Int32Array, b: Int32Array): number {
  const ka = Math.max(...a) + 1, kb = Math.max(...b) + 1;
  if (ka < 2 || kb < 2) return 0;
  const tab = new Float64Array(ka * kb), ra = new Float64Array(ka), rb = new Float64Array(kb);
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] < 0 || b[i] < 0) continue;
    tab[a[i] * kb + b[i]]++; ra[a[i]]++; rb[b[i]]++; n++;
  }
  if (!n) return 0;
  let chi2 = 0;
  for (let i = 0; i < ka; i++) for (let j = 0; j < kb; j++) {
    const e = (ra[i] * rb[j]) / n;
    if (e > 0) chi2 += (tab[i * kb + j] - e) ** 2 / e;
  }
  const k = Math.min(ka, kb) - 1;
  return k > 0 ? Math.sqrt(chi2 / (n * k)) : 0;
}

/* ---------- single-feature predictive power (leakage screen) ---------- */

/** Bin a column into integer codes using cut points learned on `fitIdx` (quantiles for numeric). */
function binCodes(col: Column, fitIdx: number[], bins = 20): Int32Array {
  if (col.kind !== 'numeric') return codes(col, 100);
  const vals = fitIdx.map((i) => col.values[i]).filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
  const cuts: number[] = [];
  for (let q = 1; q < bins; q++) {
    const v = vals[Math.floor((q / bins) * (vals.length - 1))];
    if (v !== undefined && v !== cuts[cuts.length - 1]) cuts.push(v);
  }
  const out = new Int32Array(col.values.length);
  for (let i = 0; i < out.length; i++) {
    const v = col.values[i];
    if (Number.isNaN(v)) { out[i] = cuts.length + 1; continue; }
    let lo = 0, hi = cuts.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (v > cuts[m]) lo = m + 1; else hi = m; }
    out[i] = lo;
  }
  return out;
}

/**
 * Fit a lookup table (bin → majority class / mean) on half the rows and score it on the other half.
 * Classification: (acc − baseline) / (1 − baseline). Regression: R² (clipped at 0).
 */
export function singleFeatureScore(feature: Column, y: Float64Array, classification: boolean, rows: number[], rng: Rng): number {
  const perm = rng.shuffle([...rows]);
  const half = Math.floor(perm.length / 2);
  const fit = perm.slice(0, half), test = perm.slice(half);
  if (fit.length < 10 || test.length < 10) return 0;
  const b = binCodes(feature, fit);
  if (classification) {
    const tally = new Map<number, Map<number, number>>(), global = new Map<number, number>();
    for (const i of fit) {
      const t = tally.get(b[i]) ?? new Map<number, number>();
      t.set(y[i], (t.get(y[i]) ?? 0) + 1);
      tally.set(b[i], t);
      global.set(y[i], (global.get(y[i]) ?? 0) + 1);
    }
    const argmax = (m: Map<number, number>) => [...m.entries()].sort((p, q) => q[1] - p[1])[0][0];
    const base = argmax(global);
    let ok = 0, okBase = 0;
    for (const i of test) {
      const t = tally.get(b[i]);
      if ((t ? argmax(t) : base) === y[i]) ok++;
      if (base === y[i]) okBase++;
    }
    const acc = ok / test.length, baseAcc = okBase / test.length;
    return baseAcc >= 1 ? 0 : Math.max(0, (acc - baseAcc) / (1 - baseAcc));
  }
  const sums = new Map<number, [number, number]>();
  let gm = 0;
  for (const i of fit) { const e = sums.get(b[i]) ?? [0, 0]; e[0] += y[i]; e[1]++; sums.set(b[i], e); gm += y[i]; }
  gm /= fit.length;
  let tm = 0;
  for (const i of test) tm += y[i];
  tm /= test.length;
  let ssr = 0, sst = 0;
  for (const i of test) { const e = sums.get(b[i]); const p = e ? e[0] / e[1] : gm; ssr += (y[i] - p) ** 2; sst += (y[i] - tm) ** 2; }
  return sst > 0 ? Math.max(0, 1 - ssr / sst) : 0;
}

/* ---------- profile ---------- */

export function profileTable(table: ColumnarTable, target?: string): DataProfile {
  const n = table.rowCount;
  const columns = table.columns.map((c) => profileColumn(c, 10));
  const quality: QualityIssue[] = [];
  const histograms: Record<string, Histogram> = {};
  for (const c of table.columns) histograms[c.name] = histogram(c);

  for (const p of columns) {
    if (p.name === target) continue;
    const rate = n ? p.missing / n : 0;
    if (rate > 0) quality.push({ check: 'missing', status: rate > 0.5 ? 'warn' : 'auto', column: p.name, value: rate });
    if (p.unique <= 1) quality.push({ check: 'constant', status: 'auto', column: p.name });
    if (p.kind === 'id') quality.push({ check: 'idLike', status: 'auto', column: p.name });
    if (p.kind === 'text') quality.push({ check: 'textColumn', status: 'auto', column: p.name });
    if (p.kind === 'categorical' && p.unique > 50 && p.unique > 0.1 * (n - p.missing)) quality.push({ check: 'highCardinality', status: 'warn', column: p.name, value: p.unique });
  }
  // outliers: robust z (median / MAD) > 5
  for (const c of table.columns) {
    if (c.kind !== 'numeric' || c.name === target) continue;
    const v = Array.from(c.values).filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
    if (v.length < 20) continue;
    const med = v[v.length >> 1];
    const mad = [...v.map((x) => Math.abs(x - med))].sort((a, b) => a - b)[v.length >> 1] * 1.4826;
    if (!(mad > 0)) continue;
    const out = v.filter((x) => Math.abs(x - med) / mad > 5).length;
    if (out / v.length > 0.01) quality.push({ check: 'outliers', status: 'warn', column: c.name, value: out });
  }
  // duplicate rows
  const seen = new Set<string>();
  let dup = 0;
  for (let i = 0; i < n; i++) {
    const key = JSON.stringify(table.columns.map((c) => cellString(c, i)));
    if (seen.has(key)) dup++; else seen.add(key);
  }
  if (dup) quality.push({ check: 'duplicates', status: 'warn', value: dup });

  // numeric correlation matrix (≤ 40 columns)
  const numCols = table.columns.filter((c) => c.kind === 'numeric').slice(0, 40) as Extract<Column, { kind: 'numeric' }>[];
  const matrix = numCols.map((a) => numCols.map((b) => (a === b ? 1 : pearson(a.values, b.values))));

  let targetInfo: DataProfile['target'];
  if (target) {
    const tc = getColumn(table, target);
    const task = inferTask(tc);
    const cls = task !== 'regression';
    const ycodes = codes(tc, 1000);
    const y = cls ? Float64Array.from(ycodes) : (tc.kind === 'numeric' ? tc.values : new Float64Array(n).fill(NaN));
    const rows: number[] = [];
    for (let i = 0; i < n; i++) if (!Number.isNaN(y[i]) && y[i] >= 0) rows.push(i);
    const relations: TargetRelation[] = [];
    const rng = new Rng(20240101);
    for (const c of table.columns) {
      if (c.name === target || c.kind === 'text') continue;
      let assoc: number, assocKind: TargetRelation['assocKind'];
      if (cls) {
        if (c.kind === 'numeric') { assoc = correlationRatio(ycodes, c.values); assocKind = 'eta'; }
        else { assoc = cramersV(codes(c), ycodes); assocKind = 'cramersV'; }
      } else if (c.kind === 'numeric') { assoc = Math.abs(pearson(c.values, y)); assocKind = 'pearson'; }
      else { assoc = correlationRatio(codes(c), y); assocKind = 'eta'; }
      const score = c.kind === 'id' ? 0 : singleFeatureScore(c, y, cls, rows, rng.fork(c.name));
      relations.push({ feature: c.name, assoc, assocKind, score });
      if (c.kind !== 'id' && score >= LEAKAGE_THRESHOLD) quality.push({ check: 'leakage', status: 'warn', column: c.name, value: score });
    }
    relations.sort((a, b) => b.score - a.score || b.assoc - a.assoc);
    let classes: { label: string; count: number }[] | undefined;
    if (cls) {
      classes = (profileColumn(tc, 1000).top ?? []).map((t) => ({ label: t.value, count: t.count }));
      const counts = classes.map((x) => x.count);
      const ratio = Math.min(...counts) / Math.max(...counts);
      if (ratio < 0.2) quality.push({ check: 'imbalance', status: 'warn', column: target, value: ratio });
    }
    targetInfo = { column: target, task, classes, relations };
  }
  const order: Record<QualityStatus, number> = { warn: 0, auto: 1, pass: 2 };
  quality.sort((a, b) => order[a.status] - order[b.status]);
  return { rowCount: n, columns, quality, histograms, correlation: { columns: numCols.map((c) => c.name), matrix }, target: targetInfo };
}
