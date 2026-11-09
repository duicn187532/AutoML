import { cellString, getColumn, type Column, type ColumnarTable } from '../data/table';
import type { Matrix } from './matrix';
import { hashString } from '../rng';
import type { Rng } from '../rng';
import { kFold } from './split';

/**
 * Tabular preprocessing. Statistics are fitted on TRAINING ROWS ONLY and stored as plain JSON,
 * so the exact same transform is replayed at validation / test / prediction / export time.
 * (The legacy app fitted on the full dataset → validation leakage.)
 */
export type TaskKind = 'binary' | 'multiclass' | 'regression';

export interface PreprocessConfig {
  numericScaling: 'standard' | 'minmax' | 'none';
  numericImpute: 'median' | 'mean';
  /** Keep the N most frequent categories (in train); the rest map to an "other" slot. */
  maxCategories: number;
  missingIndicators: boolean;
  /** How categorical columns become numbers. Target encoding is fitted on training rows only (smoothed). */
  categoricalEncoding?: 'onehot' | 'ordinal' | 'target' | 'hash';
  /** TF-IDF vocabulary size for text columns (top terms by document frequency in train). */
  textVocab?: number;
  hashBuckets?: number;
}

export const DEFAULT_PREPROCESS: PreprocessConfig = {
  numericScaling: 'standard',
  numericImpute: 'median',
  maxCategories: 30,
  missingIndicators: true,
  categoricalEncoding: 'onehot',
  hashBuckets: 32,
};

export type FeatureStep =
  | { type: 'numeric'; column: string; fill: number; center: number; scale: number; indicator: boolean }
  | { type: 'onehot'; column: string; categories: string[]; other: boolean }
  | { type: 'ordinal'; column: string; categories: string[] }
  | { type: 'hash'; column: string; buckets: number }
  | { type: 'target'; column: string; outputs: number; table: Record<string, number[]>; prior: number[] }
  | { type: 'tfidf'; column: string; vocab: string[]; idf: number[] }
  | { type: 'datetime'; column: string; parts: ('year' | 'month' | 'day' | 'dow')[]; fill: number[]; center: number[]; scale: number[] };

export interface PreprocessorState {
  version: 1;
  config: PreprocessConfig;
  steps: FeatureStep[];
  outputNames: string[];
  /** Columns that were requested but skipped (unsupported kind / empty). */
  skipped: { column: string; reason: string }[];
}

export const MISSING_TOKEN = '__missing__';

function quantileSorted(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function numericStats(values: number[], cfg: PreprocessConfig): { fill: number; center: number; scale: number } {
  if (!values.length) return { fill: 0, center: 0, scale: 1 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const fill = cfg.numericImpute === 'median' ? quantileSorted(sorted, 0.5) : mean;
  if (cfg.numericScaling === 'none') return { fill, center: 0, scale: 1 };
  if (cfg.numericScaling === 'minmax') {
    const min = sorted[0], max = sorted[sorted.length - 1];
    return { fill, center: min, scale: max - min || 1 };
  }
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return { fill, center: mean, scale: Math.sqrt(variance) || 1 };
}

const DT_PARTS = ['year', 'month', 'day', 'dow'] as const;
function dateParts(s: string | null): number[] | null {
  if (s === null) return null;
  const t = Date.parse(s.replace(/\//g, '-'));
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCDay()];
}

export function fitPreprocessor(
  table: ColumnarTable,
  features: string[],
  trainIdx: ArrayLike<number>,
  config: PreprocessConfig = DEFAULT_PREPROCESS,
  /** Needed only for target encoding: encoded target (class index or value) for every row. */
  target?: { y: Float64Array; nClasses: number },
): PreprocessorState {
  const steps: FeatureStep[] = [];
  const skipped: PreprocessorState['skipped'] = [];
  for (const name of features) {
    const col = getColumn(table, name);
    if (col.kind === 'numeric') {
      const vals: number[] = [];
      let missing = 0;
      for (let i = 0; i < trainIdx.length; i++) {
        const v = col.values[trainIdx[i]];
        if (Number.isNaN(v)) missing++; else vals.push(v);
      }
      if (!vals.length) { skipped.push({ column: name, reason: 'all-missing' }); continue; }
      steps.push({ type: 'numeric', column: name, ...numericStats(vals, config), indicator: config.missingIndicators && missing > 0 });
    } else if (col.kind === 'categorical') {
      const counts = new Map<string, number>();
      for (let i = 0; i < trainIdx.length; i++) {
        const v = col.values[trainIdx[i]] ?? MISSING_TOKEN;
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
      if (sorted.length < 2) { skipped.push({ column: name, reason: 'constant' }); continue; }
      const enc = config.categoricalEncoding ?? 'onehot';
      if (enc === 'ordinal') steps.push({ type: 'ordinal', column: name, categories: sorted.map(([v]) => v) });
      else if (enc === 'hash') steps.push({ type: 'hash', column: name, buckets: config.hashBuckets ?? 32 });
      else if (enc === 'target' && target) steps.push(fitTargetEncoding(col, name, trainIdx, target));
      else steps.push({ type: 'onehot', column: name, categories: sorted.slice(0, config.maxCategories).map(([v]) => v), other: true });
    } else if (col.kind === 'datetime') {
      const per: number[][] = DT_PARTS.map(() => []);
      for (let i = 0; i < trainIdx.length; i++) {
        const p = dateParts(col.values[trainIdx[i]]);
        if (p) p.forEach((v, k) => per[k].push(v));
      }
      if (!per[0].length) { skipped.push({ column: name, reason: 'unparseable-dates' }); continue; }
      const st = per.map((v) => numericStats(v, config));
      steps.push({ type: 'datetime', column: name, parts: [...DT_PARTS], fill: st.map((s) => s.fill), center: st.map((s) => s.center), scale: st.map((s) => s.scale) });
    } else if (col.kind === 'text') {
      const st = fitTfidf(col, name, trainIdx, config.textVocab ?? 200);
      if (st) steps.push(st); else skipped.push({ column: name, reason: 'empty-vocabulary' });
    } else {
      skipped.push({ column: name, reason: `unsupported-kind:${col.kind}` });
    }
  }
  return { version: 1, config, steps, outputNames: outputNames(steps), skipped };
}

/** Words (Latin etc.) plus character bigrams for CJK runs, lower-cased. */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const m of text.toLowerCase().matchAll(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+|[\p{L}\p{N}]{2,}/gu)) {
    const w = m[0];
    if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(w)) {
      if (w.length === 1) out.push(w);
      for (let i = 0; i + 1 < w.length; i++) out.push(w.slice(i, i + 2));
    } else out.push(w);
  }
  return out;
}

function fitTfidf(col: Column, name: string, trainIdx: ArrayLike<number>, maxVocab: number): FeatureStep | null {
  const df = new Map<string, number>();
  let n = 0;
  for (let i = 0; i < trainIdx.length; i++) {
    const s = cellString(col, trainIdx[i]);
    if (s === null) continue;
    n++;
    for (const tok of new Set(tokenize(s))) df.set(tok, (df.get(tok) ?? 0) + 1);
  }
  const vocab = [...df.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, maxVocab).map(([t]) => t);
  if (!vocab.length) return null;
  return { type: 'tfidf', column: name, vocab, idf: vocab.map((t) => Math.log((1 + n) / (1 + df.get(t)!)) + 1) };
}

/** Smoothed target mean per category (m-estimate, m = 10); multiclass → one column per class. */
function fitTargetEncoding(col: Column, name: string, trainIdx: ArrayLike<number>, target: { y: Float64Array; nClasses: number }): FeatureStep {
  const k = target.nClasses || 1;
  const outputs = target.nClasses > 2 ? k : 1;
  const enc = (y: number) => (target.nClasses > 2 ? Array.from({ length: k }, (_, c) => (y === c ? 1 : 0)) : [y]);
  const prior = new Array<number>(outputs).fill(0);
  const sums = new Map<string, { s: number[]; n: number }>();
  let n = 0;
  for (let i = 0; i < trainIdx.length; i++) {
    const r = trainIdx[i], y = target.y[r];
    if (Number.isNaN(y)) continue;
    const v = enc(y), key = cellString(col, r) ?? MISSING_TOKEN;
    const e = sums.get(key) ?? { s: new Array<number>(outputs).fill(0), n: 0 };
    v.forEach((x, j) => { e.s[j] += x; prior[j] += x; });
    e.n++; n++;
    sums.set(key, e);
  }
  prior.forEach((_, j) => (prior[j] /= n || 1));
  const m = 10;
  const table: Record<string, number[]> = {};
  for (const [key, e] of sums) table[key] = e.s.map((x, j) => (x + m * prior[j]) / (e.n + m));
  return { type: 'target', column: name, outputs, table, prior };
}

function outputNames(steps: FeatureStep[]): string[] {
  const out: string[] = [];
  for (const s of steps) {
    if (s.type === 'numeric') {
      out.push(s.column);
      if (s.indicator) out.push(`${s.column}__isna`);
    } else if (s.type === 'onehot') {
      for (const c of s.categories) out.push(`${s.column}=${c}`);
      if (s.other) out.push(`${s.column}=__other__`);
    } else if (s.type === 'ordinal') out.push(`${s.column}#ord`);
    else if (s.type === 'hash') for (let b = 0; b < s.buckets; b++) out.push(`${s.column}#h${b}`);
    else if (s.type === 'target') for (let j = 0; j < s.outputs; j++) out.push(`${s.column}#te${s.outputs > 1 ? j : ''}`);
    else if (s.type === 'tfidf') for (const w of s.vocab) out.push(`${s.column}~${w}`);
    else for (const p of s.parts) out.push(`${s.column}.${p}`);
  }
  return out;
}

/** Apply a fitted preprocessor to (a subset of) rows. Unknown categories → "other" slot. */
export function transform(state: PreprocessorState, table: ColumnarTable, rowIdx?: ArrayLike<number>): Matrix {
  const n = rowIdx ? rowIdx.length : table.rowCount;
  const cols = state.outputNames.length;
  const data = new Float64Array(n * cols);
  let offset = 0;
  for (const s of state.steps) {
    const col: Column = getColumn(table, s.column);
    if (s.type === 'numeric') {
      if (col.kind !== 'numeric') throw new Error(`Column ${s.column} is no longer numeric`);
      for (let i = 0; i < n; i++) {
        const v = col.values[rowIdx ? rowIdx[i] : i];
        const miss = Number.isNaN(v);
        data[i * cols + offset] = ((miss ? s.fill : v) - s.center) / s.scale;
        if (s.indicator) data[i * cols + offset + 1] = miss ? 1 : 0;
      }
      offset += s.indicator ? 2 : 1;
    } else if (s.type === 'onehot') {
      const index = new Map(s.categories.map((c, k) => [c, k]));
      const width = s.categories.length + (s.other ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const v = cellString(col, rowIdx ? rowIdx[i] : i) ?? MISSING_TOKEN;
        const k = index.get(v);
        if (k !== undefined) data[i * cols + offset + k] = 1;
        else if (s.other) data[i * cols + offset + s.categories.length] = 1;
      }
      offset += width;
    } else if (s.type === 'ordinal') {
      const index = new Map(s.categories.map((c, k) => [c, k]));
      const scale = Math.max(1, s.categories.length - 1);
      for (let i = 0; i < n; i++) {
        const k = index.get(cellString(col, rowIdx ? rowIdx[i] : i) ?? MISSING_TOKEN);
        data[i * cols + offset] = k === undefined ? -1 : k / scale;
      }
      offset += 1;
    } else if (s.type === 'hash') {
      for (let i = 0; i < n; i++) data[i * cols + offset + (hashString(cellString(col, rowIdx ? rowIdx[i] : i) ?? MISSING_TOKEN) % s.buckets)] = 1;
      offset += s.buckets;
    } else if (s.type === 'tfidf') {
      const index = new Map(s.vocab.map((w, k) => [w, k]));
      for (let i = 0; i < n; i++) {
        const txt = cellString(col, rowIdx ? rowIdx[i] : i);
        if (txt === null) continue;
        let norm = 0;
        for (const tok of tokenize(txt)) { const k = index.get(tok); if (k !== undefined) data[i * cols + offset + k] += s.idf[k]; }
        for (let k = 0; k < s.vocab.length; k++) norm += data[i * cols + offset + k] ** 2;
        if (norm > 0) { norm = Math.sqrt(norm); for (let k = 0; k < s.vocab.length; k++) data[i * cols + offset + k] /= norm; }
      }
      offset += s.vocab.length;
    } else if (s.type === 'target') {
      for (let i = 0; i < n; i++) {
        const v = s.table[cellString(col, rowIdx ? rowIdx[i] : i) ?? MISSING_TOKEN] ?? s.prior;
        for (let j = 0; j < s.outputs; j++) data[i * cols + offset + j] = v[j];
      }
      offset += s.outputs;
    } else {
      for (let i = 0; i < n; i++) {
        const p = dateParts(cellString(col, rowIdx ? rowIdx[i] : i));
        for (let k = 0; k < s.parts.length; k++) {
          const v = p ? p[k] : s.fill[k];
          data[i * cols + offset + k] = (v - s.center[k]) / s.scale[k];
        }
      }
      offset += s.parts.length;
    }
  }
  return { rows: n, cols, data };
}

/**
 * Cross-fitted target encoding for TRAINING rows. A row's target is never used
 * to encode that row: each inner fold is transformed with a lookup fitted on
 * its complementary rows. The full-training lookup in `state` remains the
 * one used for validation, test, saved predictions and portable exports.
 */
export function transformTraining(
  state: PreprocessorState,
  table: ColumnarTable,
  trainIdx: ArrayLike<number>,
  target: { y: Float64Array; nClasses: number },
  rng: Rng,
): Matrix {
  const X = transform(state, table, trainIdx);
  if (!state.steps.some((s) => s.type === 'target')) return X;
  if (trainIdx.length < 2) throw new Error('Cross-fitted target encoding requires at least 2 training rows');
  const stratify = target.nClasses > 0 ? Array.from({ length: trainIdx.length }, (_, i) => target.y[trainIdx[i]]) : undefined;
  const folds = kFold(trainIdx.length, Math.min(5, trainIdx.length), rng, stratify);
  let offset = 0;
  for (const step of state.steps) {
    if (step.type === 'target') {
      const col = getColumn(table, step.column);
      for (const fold of folds) {
        const fitRows = Int32Array.from(fold.train, (i) => trainIdx[i]);
        const encoded = fitTargetEncoding(col, step.column, fitRows, target);
        for (const localRow of fold.valid) {
          const key = cellString(col, trainIdx[localRow]) ?? MISSING_TOKEN;
          const values = encoded.table[key] ?? encoded.prior;
          for (let j = 0; j < step.outputs; j++) X.data[localRow * X.cols + offset + j] = values[j];
        }
      }
    }
    offset += step.type === 'numeric' ? (step.indicator ? 2 : 1)
      : step.type === 'onehot' ? step.categories.length + (step.other ? 1 : 0)
      : step.type === 'hash' ? step.buckets
      : step.type === 'target' ? step.outputs
      : step.type === 'tfidf' ? step.vocab.length
      : step.type === 'datetime' ? step.parts.length
      : 1;
  }
  return X;
}

/* ---------- target ---------- */

export type TargetState =
  | { task: 'binary' | 'multiclass'; column: string; classes: string[] }
  | { task: 'regression'; column: string; mean: number; std: number };

/** Guess the task from the target column (numeric with few distinct integers → classification). */
export function inferTask(col: Column): TaskKind {
  const distinct = new Set<string>();
  let nonMissing = 0, allInt = true;
  for (let i = 0; i < col.values.length; i++) {
    const s = cellString(col, i);
    if (s === null) continue;
    nonMissing++;
    if (distinct.size <= 1000) distinct.add(s);
    if (col.kind === 'numeric' && !Number.isInteger(col.values[i] as number)) allInt = false;
  }
  if (col.kind === 'numeric') {
    if (allInt && distinct.size <= Math.min(20, Math.max(2, nonMissing / 10))) return distinct.size === 2 ? 'binary' : 'multiclass';
    return 'regression';
  }
  return distinct.size === 2 ? 'binary' : 'multiclass';
}

/** Fit target encoding on training rows (class list is taken from all non-missing rows so every label is known). */
export function fitTarget(table: ColumnarTable, target: string, task: TaskKind, trainIdx: ArrayLike<number>): TargetState {
  const col = getColumn(table, target);
  if (task === 'regression') {
    if (col.kind !== 'numeric') throw new Error(`Regression target "${target}" must be numeric`);
    const vals: number[] = [];
    for (let i = 0; i < trainIdx.length; i++) {
      const v = col.values[trainIdx[i]];
      if (!Number.isNaN(v)) vals.push(v);
    }
    const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
    const std = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / (vals.length || 1)) || 1;
    return { task, column: target, mean, std };
  }
  const set = new Set<string>();
  for (let i = 0; i < col.values.length; i++) {
    const s = cellString(col, i);
    if (s !== null) set.add(s);
  }
  const classes = [...set].sort((a, b) => {
    const na = Number(a), nb = Number(b);
    return Number.isFinite(na) && Number.isFinite(nb) ? na - nb : a < b ? -1 : a > b ? 1 : 0;
  });
  if (classes.length < 2) throw new Error(`Target "${target}" has fewer than 2 classes`);
  return { task: classes.length === 2 ? 'binary' : 'multiclass', column: target, classes };
}

/** Encode target; returns class indices (classification) or raw values (regression). NaN / -1 = missing. */
export function encodeTarget(state: TargetState, table: ColumnarTable): Float64Array {
  const col = getColumn(table, state.column);
  const out = new Float64Array(table.rowCount);
  if (state.task === 'regression') {
    for (let i = 0; i < out.length; i++) out[i] = col.kind === 'numeric' ? col.values[i] : NaN;
    return out;
  }
  const index = new Map(state.classes.map((c, k) => [c, k]));
  for (let i = 0; i < out.length; i++) {
    const s = cellString(col, i);
    out[i] = s === null ? NaN : (index.get(s) ?? NaN);
  }
  return out;
}

/** Row indices whose target is present. */
export function labelledRows(y: Float64Array): Int32Array {
  const idx: number[] = [];
  for (let i = 0; i < y.length; i++) if (!Number.isNaN(y[i])) idx.push(i);
  return Int32Array.from(idx);
}
