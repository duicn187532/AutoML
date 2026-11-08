import { cellString, getColumn } from '../../data/table';
import type { Matrix } from '../../ml/matrix';
import { transform, type PreprocessorState, type TargetState } from '../../ml/preprocess';
import { getPlugin } from '../../models/registry';
import type { ModelArtifact } from '../../models/types';
import { decodeBinJson } from '../../storage/binjson';
import type { BaggedMember, PredictInput, PredictOutput, TaskContext } from '../types';

interface SingleBlob { artifact: ModelArtifact; preprocessor: PreprocessorState; target: TargetState }
interface EnsembleBlob { kind: 'bagged-ensemble'; task: string; target: TargetState; members: BaggedMember[] }

/** Engines a stored model needs (read from the blob without loading anything). */
export function modelEngines(bytes: Uint8Array): string[] {
  const b = decodeBinJson<SingleBlob | EnsembleBlob>(bytes);
  const ids = 'kind' in b ? b.members.map((m) => m.pluginId) : [b.artifact.pluginId];
  return [...new Set(ids.flatMap((id) => getPlugin(id).engines))];
}

async function scoreOne(art: ModelArtifact, prep: PreprocessorState, input: PredictInput, ctx: TaskContext): Promise<Matrix> {
  const plugin = getPlugin(art.pluginId);
  const model = await plugin.load(art, { task: art.task, nFeatures: art.nFeatures, nClasses: art.nClasses, engine: ctx.engine });
  const X = transform(prep, input.table);
  try {
    if (art.task === 'regression') return { rows: X.rows, cols: 1, data: model.predict(X) };
    return model.predictProba!(X);
  } finally {
    model.dispose?.();
  }
}

/**
 * Apply a stored model (single model or bagged Auto-mode ensemble) to a table.
 * Columns must match by name; the stored preprocessing is replayed exactly.
 */
export async function predictTask(input: PredictInput, ctx: TaskContext): Promise<PredictOutput> {
  const blob = decodeBinJson<SingleBlob | EnsembleBlob>(input.model);
  const target = blob.target;
  const parts: { weight: number; art: ModelArtifact; prep: PreprocessorState }[] = 'kind' in blob
    ? blob.members.flatMap((m) => m.folds.map((f) => ({ weight: m.weight / m.folds.length, art: f.artifact, prep: f.preprocessor })))
    : [{ weight: 1, art: blob.artifact, prep: blob.preprocessor }];
  const missing = [...new Set(parts.flatMap((p) => p.prep.steps.map((s) => s.column)))].filter((c) => !input.table.columns.some((x) => x.name === c));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(', ')}`);
  let acc: Float64Array | null = null, cols = 1;
  for (let i = 0; i < parts.length; i++) {
    const P = await scoreOne(parts[i].art, parts[i].prep, input, ctx);
    cols = P.cols;
    acc ??= new Float64Array(P.data.length);
    for (let j = 0; j < P.data.length; j++) acc[j] += parts[i].weight * P.data[j];
    ctx.progress({ fraction: (i + 1) / parts.length });
    await ctx.checkpoint();
  }
  const n = input.table.rowCount;
  const ids = input.idColumn ? Array.from({ length: n }, (_, i) => cellString(getColumn(input.table, input.idColumn!), i)) : undefined;
  if (target.task === 'regression') {
    return { task: 'regression', prediction: Array.from(acc!, (v) => v * target.std + target.mean), ids };
  }
  const labels: string[] = [], proba: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = Array.from(acc!.subarray(i * cols, (i + 1) * cols));
    let best = 0;
    for (let c = 1; c < cols; c++) if (row[c] > row[best]) best = c;
    labels.push(target.classes[best]);
    proba.push(row);
  }
  return { task: target.task, prediction: labels, proba, classes: target.classes, ids };
}
