/**
 * Seeded, reproducible PRNG (xoshiro128**, seeded via splitmix32).
 * Every random step in the app takes an Rng; derive independent streams with `fork(label)`
 * so adding a new random step never shifts the numbers drawn by other steps.
 */
export interface RngState {
  s: [number, number, number, number];
}

function splitmix32(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x9e3779b9) >>> 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

/** FNV-1a 32-bit hash of a string (used to derive child seeds from labels). */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;

export class Rng {
  private s: Uint32Array;
  readonly seed: number;
  private spareNormal: number | null = null;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    const sm = splitmix32(this.seed);
    this.s = new Uint32Array([sm(), sm(), sm(), sm()]);
    if (this.s.every((v) => v === 0)) this.s[0] = 1;
  }

  /** Uniform uint32. */
  nextU32(): number {
    const s = this.s;
    const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    return result;
  }

  /** Uniform float in [0, 1) with 53 bits of randomness. */
  next(): number {
    const hi = this.nextU32() >>> 5; // 27 bits
    const lo = this.nextU32() >>> 6; // 26 bits
    return (hi * 67108864 + lo) / 9007199254740992;
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    if (!(n > 0) || !Number.isFinite(n)) throw new RangeError(`Rng.int: invalid bound ${n}`);
    return Math.floor(this.next() * n);
  }

  uniform(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }

  /** Standard normal (Box–Muller, cached pair). */
  normal(mean = 0, std = 1): number {
    if (this.spareNormal !== null) {
      const v = this.spareNormal;
      this.spareNormal = null;
      return mean + std * v;
    }
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spareNormal = r * Math.sin(2 * Math.PI * v);
    return mean + std * r * Math.cos(2 * Math.PI * v);
  }

  /** In-place Fisher–Yates shuffle. */
  shuffle<T extends { length: number; [i: number]: unknown }>(arr: T): T {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /** Random permutation of 0..n-1. */
  permutation(n: number): Int32Array {
    const p = new Int32Array(n);
    for (let i = 0; i < n; i++) p[i] = i;
    return this.shuffle(p);
  }

  /** Independent child stream, deterministic in (seed, label). */
  fork(label: string): Rng {
    return new Rng((Math.imul(this.seed ^ hashString(label), 0x9e3779b1) + hashString(label)) >>> 0);
  }

  getState(): RngState {
    return { s: [this.s[0], this.s[1], this.s[2], this.s[3]] };
  }

  setState(state: RngState): void {
    this.s.set(state.s);
    this.spareNormal = null;
  }
}

/** Random 32-bit seed for new projects (uses crypto when available). */
export function freshSeed(): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0];
  return (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
}
