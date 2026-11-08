import { describe, expect, it } from 'vitest';
import { Rng, hashString } from '@/core/rng';

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(42), b = new Rng(42);
    const xs = Array.from({ length: 100 }, () => a.next());
    expect(Array.from({ length: 100 }, () => b.next())).toEqual(xs);
    expect(new Rng(43).next()).not.toBe(xs[0]);
  });

  it('produces values in [0,1) with sane moments', () => {
    const r = new Rng(1);
    let s = 0, s2 = 0, lo = 1, hi = 0;
    const n = 50_000;
    for (let i = 0; i < n; i++) {
      const v = r.next();
      lo = Math.min(lo, v); hi = Math.max(hi, v);
      s += v; s2 += v * v;
    }
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThan(1);
    expect(s / n).toBeCloseTo(0.5, 2);
    expect(s2 / n - (s / n) ** 2).toBeCloseTo(1 / 12, 2);
  });

  it('normal() has mean 0, std 1', () => {
    const r = new Rng(7);
    const xs = Array.from({ length: 40_000 }, () => r.normal());
    const m = xs.reduce((a, b) => a + b) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
    expect(m).toBeCloseTo(0, 1);
    expect(sd).toBeCloseTo(1, 1);
  });

  it('fork() streams are independent of draw order', () => {
    const a = new Rng(5);
    const f1 = a.fork('split').next();
    const b = new Rng(5);
    b.next(); b.next();
    expect(b.fork('split').next()).toBe(f1);
    expect(a.fork('model').next()).not.toBe(f1);
  });

  it('permutation is a permutation; state round-trips', () => {
    const r = new Rng(9);
    const p = Array.from(r.permutation(50)).sort((x, y) => x - y);
    expect(p).toEqual(Array.from({ length: 50 }, (_, i) => i));
    const st = r.getState();
    const v = r.nextU32();
    r.setState(st);
    expect(r.nextU32()).toBe(v);
    expect(hashString('abc')).toBe(0x1a47e90b);
  });

  it('int() rejects bad bounds', () => {
    expect(() => new Rng(1).int(0)).toThrow();
  });
});
