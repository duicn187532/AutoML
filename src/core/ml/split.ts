import type { Rng } from '../rng';

/**
 * Parse a timestamp into a comparable UTC millisecond value.
 * Calendar dates without a timezone are interpreted as UTC for reproducibility.
 * Numeric values represent a consistent user-supplied chronological scale.
 */
export function parseTimeValue(value: string | number | null): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Time split contains a missing or non-finite timestamp');
    return value;
  }
  const s = value?.trim();
  if (!s) throw new Error('Time split contains a missing timestamp');
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(s);
  if (!m) throw new Error(`Unparseable time split value: ${s}`);
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const h = Number(m[4] ?? 0), min = Number(m[5] ?? 0), sec = Number(m[6] ?? 0);
  const ms = Number((m[7] ?? '').slice(1).padEnd(3, '0'));
  const day = new Date(Date.UTC(y, mo - 1, d));
  if (y < 100 || day.getUTCFullYear() !== y || day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d
    || h > 23 || min > 59 || sec > 59) throw new Error(`Invalid time split date: ${s}`);
  let offset = 0;
  const tz = m[8];
  if (tz && tz !== 'Z') {
    const zh = Number(tz.slice(1, 3)), zm = Number(tz.slice(4, 6));
    if (zh > 14 || zm > 59 || (zh === 14 && zm !== 0)) throw new Error(`Invalid time zone offset: ${s}`);
    offset = (tz[0] === '+' ? 1 : -1) * (zh * 60 + zm);
  }
  return Date.UTC(y, mo - 1, d, h, min, sec, ms) - offset * 60_000;
}


export interface SplitIndices {
  train: Int32Array;
  valid: Int32Array;
  test: Int32Array;
}

export interface HoldoutOptions {
  validFraction: number;
  testFraction?: number;
  /** Class labels for stratification (classification). */
  stratify?: ArrayLike<number>;
}

const sortI32 = (a: number[]) => Int32Array.from(a).sort();

/** Group row indices by stratum, each group shuffled. */
function strata(n: number, rng: Rng, stratify?: ArrayLike<number>): number[][] {
  if (!stratify) return [Array.from(rng.permutation(n))];
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const k = stratify[i];
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(i);
  }
  return [...groups.keys()].sort((a, b) => a - b).map((k) => rng.shuffle(groups.get(k)!));
}

/** Train / valid / test hold-out split (optionally stratified). Indices are returned sorted. */
export function holdoutSplit(n: number, rng: Rng, opts: HoldoutOptions): SplitIndices {
  const vf = opts.validFraction, tf = opts.testFraction ?? 0;
  if (vf < 0 || tf < 0 || vf + tf >= 1) throw new RangeError('validFraction + testFraction must be in [0, 1)');
  const train: number[] = [], valid: number[] = [], test: number[] = [];
  for (const g of strata(n, rng, opts.stratify)) {
    let nTest = Math.round(g.length * tf);
    let nValid = Math.round(g.length * vf);
    // keep at least one training sample per stratum
    while (g.length - nTest - nValid < 1 && nValid + nTest > 0) {
      if (nValid >= nTest && nValid > 0) nValid--;
      else nTest--;
    }
    test.push(...g.slice(0, nTest));
    valid.push(...g.slice(nTest, nTest + nValid));
    train.push(...g.slice(nTest + nValid));
  }
  return { train: sortI32(train), valid: sortI32(valid), test: sortI32(test) };
}

export interface Fold {
  train: Int32Array;
  valid: Int32Array;
}

/** K-fold (stratified when labels given). Each row appears in exactly one validation fold. */
export function kFold(n: number, k: number, rng: Rng, stratify?: ArrayLike<number>): Fold[] {
  if (k < 2 || k > n) throw new RangeError(`k must be in [2, n], got ${k}`);
  const assign = new Int32Array(n);
  let offset = 0;
  for (const g of strata(n, rng, stratify)) {
    // round-robin, continuing across strata so fold sizes stay balanced
    g.forEach((row, i) => { assign[row] = (i + offset) % k; });
    offset = (offset + g.length) % k;
  }
  return Array.from({ length: k }, (_, f) => {
    const tr: number[] = [], va: number[] = [];
    for (let i = 0; i < n; i++) (assign[i] === f ? va : tr).push(i);
    return { train: Int32Array.from(tr), valid: Int32Array.from(va) };
  });
}

export type SplitKind = 'holdout' | 'time' | 'group' | 'kfold';

export interface SplitConfig {
  kind: SplitKind;
  validFraction: number;
  /** Held out and evaluated exactly once, after model selection. */
  testFraction: number;
  /** time: ordering column; group: grouping column. */
  column?: string;
  folds?: number;
}

/** Time-ordered split: oldest rows train, then valid, newest rows test (no shuffling). */
export function timeSplit(order: ArrayLike<number>, opts: { validFraction: number; testFraction?: number }): SplitIndices {
  const n = order.length;
  const vf = opts.validFraction, tf = opts.testFraction ?? 0;
  if (!Number.isFinite(vf) || !Number.isFinite(tf) || vf < 0 || tf < 0 || vf + tf >= 1)
    throw new RangeError('validFraction + testFraction must be in [0, 1)');
  for (let i = 0; i < n; i++) if (!Number.isFinite(order[i])) throw new Error(`Time split row ${i} has an invalid timestamp`);
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => (order[a] < order[b] ? -1 : order[a] > order[b] ? 1 : a - b));
  const nTest = Math.round(n * tf), nValid = Math.round(n * vf);
  const nTrain = n - nTest - nValid;
  if (nTrain < 1) throw new RangeError('validFraction + testFraction too large');
  for (const at of [nTrain, nTrain + nValid]) {
    if (at > 0 && at < n && order[idx[at - 1]] === order[idx[at]])
      throw new Error('Time split boundary divides identical timestamps; use a finer time column or different fractions');
  }
  return {
    train: sortI32(idx.slice(0, nTrain)),
    valid: sortI32(idx.slice(nTrain, nTrain + nValid)),
    test: sortI32(idx.slice(nTrain + nValid)),
  };
}

/** Group split: all rows of a group land in the same part (no group leaks across train / valid / test). */
export function groupSplit(groups: ArrayLike<string | number>, rng: Rng, opts: { validFraction: number; testFraction?: number }): SplitIndices {
  const byGroup = new Map<string | number, number[]>();
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(i);
  }
  const keys = rng.shuffle([...byGroup.keys()]);
  const n = groups.length, wantTest = n * (opts.testFraction ?? 0), wantValid = n * opts.validFraction;
  const train: number[] = [], valid: number[] = [], test: number[] = [];
  for (const k of keys) {
    const rows = byGroup.get(k)!;
    if (test.length < wantTest) test.push(...rows);
    else if (valid.length < wantValid) valid.push(...rows);
    else train.push(...rows);
  }
  if (!train.length) throw new RangeError('Not enough groups for this split');
  return { train: sortI32(train), valid: sortI32(valid), test: sortI32(test) };
}

/** Group k-fold: whole groups per fold. */
export function groupKFold(groups: ArrayLike<string | number>, k: number, rng: Rng): Fold[] {
  const keys = rng.shuffle([...new Set(Array.from(groups))]);
  if (keys.length < k) throw new RangeError(`Need ≥ ${k} groups`);
  const fold = new Map(keys.map((g, i) => [g, i % k]));
  return Array.from({ length: k }, (_, f) => {
    const tr: number[] = [], va: number[] = [];
    for (let i = 0; i < groups.length; i++) (fold.get(groups[i]) === f ? va : tr).push(i);
    return { train: Int32Array.from(tr), valid: Int32Array.from(va) };
  });
}
