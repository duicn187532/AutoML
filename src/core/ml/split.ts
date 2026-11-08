import type { Rng } from '../rng';

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
