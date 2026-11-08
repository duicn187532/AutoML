import type { Rng } from '../rng';
import type { ParamSpec, ParamValues } from '../models/types';

/**
 * Hyper-parameter sampling over a plugin's own param schema.
 * - random(): uniform / log-uniform / categorical
 * - tpe(): Tree-structured Parzen Estimator (Bergstra 2011), simplified: split observed trials into
 *   good (top γ) / bad, model each numeric dim with Gaussian kernels in [0,1] (log-scaled where the
 *   schema says so), draw candidates from l(x) and keep the one maximising l(x)/g(x).
 */
export interface SearchDim {
  key: string;
  spec: ParamSpec;
  /** override the schema range for searching */
  range?: [number, number];
}

const toUnit = (d: SearchDim, v: number) => {
  if (d.spec.type !== 'int' && d.spec.type !== 'float') return 0;
  const [lo, hi] = d.range ?? d.spec.recommended ?? [d.spec.min, d.spec.max];
  if (d.spec.log && lo > 0) return (Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo) || 1);
  return (v - lo) / (hi - lo || 1);
};
const fromUnit = (d: SearchDim, u: number) => {
  if (d.spec.type !== 'int' && d.spec.type !== 'float') return 0;
  const [lo, hi] = d.range ?? d.spec.recommended ?? [d.spec.min, d.spec.max];
  u = Math.min(1, Math.max(0, u));
  let v = d.spec.log && lo > 0 ? Math.exp(Math.log(lo) + u * (Math.log(hi) - Math.log(lo))) : lo + u * (hi - lo);
  if (d.spec.type === 'int') v = Math.round(v);
  return v;
};

export function randomConfig(dims: SearchDim[], rng: Rng): ParamValues {
  const p: ParamValues = {};
  for (const d of dims) {
    if (d.spec.type === 'enum') p[d.key] = d.spec.options[rng.int(d.spec.options.length)].value;
    else if (d.spec.type === 'bool') p[d.key] = rng.next() < 0.5;
    else p[d.key] = fromUnit(d, rng.next());
  }
  return p;
}

export function tpeConfig(dims: SearchDim[], trials: { params: ParamValues; loss: number }[], rng: Rng, gamma = 0.25, candidates = 24): ParamValues {
  if (trials.length < 6) return randomConfig(dims, rng);
  const sorted = [...trials].sort((a, b) => a.loss - b.loss);
  const nGood = Math.max(2, Math.ceil(gamma * sorted.length));
  const good = sorted.slice(0, nGood), bad = sorted.slice(nGood);
  const bw = 0.15;
  const density = (set: typeof trials, d: SearchDim, u: number) =>
    (set.reduce((a, t) => a + Math.exp(-0.5 * ((u - toUnit(d, Number(t.params[d.key]))) / bw) ** 2), 0) + 0.1) / (set.length + 0.1);
  const catDensity = (set: typeof trials, d: SearchDim, v: unknown) => (set.filter((t) => t.params[d.key] === v).length + 1) / (set.length + 2);
  let best: ParamValues = {}, bestScore = -Infinity;
  for (let c = 0; c < candidates; c++) {
    const p: ParamValues = {};
    let score = 0;
    for (const d of dims) {
      if (d.spec.type === 'enum' || d.spec.type === 'bool') {
        const pick = good[rng.int(good.length)].params[d.key];
        const v = rng.next() < 0.2 ? randomConfig([d], rng)[d.key] : pick;
        p[d.key] = v;
        score += Math.log(catDensity(good, d, v) / catDensity(bad, d, v));
      } else {
        const center = toUnit(d, Number(good[rng.int(good.length)].params[d.key]));
        const u = Math.min(1, Math.max(0, center + rng.normal(0, bw)));
        p[d.key] = fromUnit(d, u);
        score += Math.log(density(good, d, u) / density(bad, d, u));
      }
    }
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

/** Grid: 3 levels per numeric dim (low / mid / high on the dim's scale), all options for enums. */
export function gridConfigs(dims: SearchDim[], limit: number): ParamValues[] {
  const levels = dims.map((d) => {
    if (d.spec.type === 'enum') return d.spec.options.map((o) => o.value);
    if (d.spec.type === 'bool') return [false, true];
    return [...new Set([0, 0.5, 1].map((u) => fromUnit(d, u)))];
  });
  const out: ParamValues[] = [];
  const rec = (i: number, cur: ParamValues) => {
    if (out.length >= limit) return;
    if (i === dims.length) { out.push({ ...cur }); return; }
    for (const v of levels[i]) rec(i + 1, { ...cur, [dims[i].key]: v });
  };
  rec(0, {});
  return out;
}
