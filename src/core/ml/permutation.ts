import { getColumn, type Column, type ColumnarTable } from '../data/table';
import type { Rng } from '../rng';
import type { TrainedModel } from '../models/types';
import { classificationMetrics, regressionMetrics } from './metrics';
import { transform, type PreprocessorState, type TargetState } from './preprocess';

export interface PermutationImportance {
  feature: string;
  /** Mean drop of the score (higher = more important) and 95% CI half-width. */
  mean: number;
  ci95: number;
}

/**
 * Permutation importance on RAW columns (so one-hot groups are permuted together):
 * shuffle one column across the evaluation rows, replay the stored preprocessing, re-score.
 * Score: −log loss (classification) or −RMSE (regression).
 */
export async function permutationImportance(
  model: TrainedModel, prep: PreprocessorState, target: TargetState, table: ColumnarTable, rows: Int32Array,
  y: Float64Array, rng: Rng, opts: { repeats?: number; deadline?: number; checkpoint?: () => Promise<void> } = {},
): Promise<PermutationImportance[]> {
  const repeats = opts.repeats ?? 5;
  const cls = target.task !== 'regression';
  const score = (t: ColumnarTable, idx: ArrayLike<number>) => {
    const X = transform(prep, t, idx);
    if (cls) return -(classificationMetrics(y, model.predictProba!(X)).metrics.logLoss ?? 0);
    const tg = target as Extract<TargetState, { task: 'regression' }>;
    return -(regressionMetrics(y, model.predict(X).map((v) => v * tg.std + tg.mean)).rmse ?? 0);
  };
  // a compact table with only the evaluation rows (so permutations stay inside them)
  const cols = [...new Set(prep.steps.map((s) => s.column))];
  const sub: ColumnarTable = {
    rowCount: rows.length,
    columns: cols.map((name): Column => {
      const c = getColumn(table, name);
      return c.kind === 'numeric'
        ? { name, kind: 'numeric', values: Float64Array.from(rows, (r) => c.values[r]) }
        : { name, kind: c.kind, values: Array.from(rows, (r) => c.values[r]) };
    }),
  };
  const all = Int32Array.from({ length: rows.length }, (_, i) => i);
  const base = score(sub, all);
  const out: PermutationImportance[] = [];
  for (const name of cols) {
    if (opts.deadline && performance.now() > opts.deadline) break;
    const i = sub.columns.findIndex((c) => c.name === name);
    const orig = sub.columns[i];
    const drops: number[] = [];
    for (let r = 0; r < repeats; r++) {
      const perm = rng.permutation(rows.length);
      const shuffled: Column = orig.kind === 'numeric'
        ? { ...orig, values: Float64Array.from(perm, (p) => orig.values[p]) }
        : { ...orig, values: Array.from(perm, (p) => orig.values[p]) };
      sub.columns[i] = shuffled;
      drops.push(base - score(sub, all));
    }
    sub.columns[i] = orig;
    const mean = drops.reduce((a, b) => a + b, 0) / drops.length;
    const sd = Math.sqrt(drops.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, drops.length - 1));
    out.push({ feature: name, mean, ci95: (1.96 * sd) / Math.sqrt(drops.length) });
    await opts.checkpoint?.();
  }
  return out.sort((a, b) => b.mean - a.mean);
}
