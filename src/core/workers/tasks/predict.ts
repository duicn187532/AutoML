import { cellString, getColumn } from '../../data/table';
import type { Matrix } from '../../ml/matrix';
import { transform, type PreprocessorState, type TargetState } from '../../ml/preprocess';
import { getPlugin } from '../../models/registry';
import type { ModelArtifact } from '../../models/types';
import { decodeBinJson } from '../../storage/binjson';
import type { BaggedMember, ExplainInput, ExplainOutput, PredictInput, PredictOutput, TaskContext } from '../types';
import type { PyHandle } from '../../engines/adapters';

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
  const parts: { weight: number; art: ModelArtifact; prep: PreprocessorState; target: TargetState }[] = 'kind' in blob
    ? blob.members.flatMap((m) => m.folds.map((f) => ({
      weight: m.weight / m.folds.length, art: f.artifact, prep: f.preprocessor,
      target: f.target ?? blob.target, // legacy ensemble fallback (old archives did not store per-fold scaling)
    })))
    : [{ weight: 1, art: blob.artifact, prep: blob.preprocessor, target: blob.target }];
  const missing = [...new Set(parts.flatMap((p) => p.prep.steps.map((s) => s.column)))].filter((c) => !input.table.columns.some((x) => x.name === c));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(', ')}`);
  let acc: Float64Array | null = null, cols = 1;
  for (let i = 0; i < parts.length; i++) {
    const P = await scoreOne(parts[i].art, parts[i].prep, input, ctx);
    cols = P.cols;
    acc ??= new Float64Array(P.data.length);
    if (target.task === 'regression') {
      const scale = parts[i].target;
      if (scale.task !== 'regression') throw new Error('Regression fold is missing its target scaling');
      for (let j = 0; j < P.data.length; j++) acc[j] += parts[i].weight * (P.data[j] * scale.std + scale.mean);
    } else {
      for (let j = 0; j < P.data.length; j++) acc[j] += parts[i].weight * P.data[j];
    }
    ctx.progress({ fraction: (i + 1) / parts.length });
    await ctx.checkpoint();
  }
  const n = input.table.rowCount;
  const ids = input.idColumn ? Array.from({ length: n }, (_, i) => cellString(getColumn(input.table, input.idColumn!), i)) : undefined;
  if (target.task === 'regression') {
    return { task: 'regression', prediction: Array.from(acc!), ids };
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

/**
 * Explain one row. XGBoost / LightGBM single models: TreeSHAP (exact, in margin units, encoded
 * columns summed back to raw columns). Everything else: per-feature replacement with the training
 * baseline (median / most frequent) — change in the predicted-class probability or value.
 */
export async function explainTask(input: ExplainInput, ctx: TaskContext): Promise<ExplainOutput> {
  const blob = decodeBinJson<SingleBlob | EnsembleBlob>(input.model);
  const row = { rowCount: 1, columns: input.table.columns.map((c) => c.kind === 'numeric' ? { ...c, values: Float64Array.of(c.values[input.row]) } : { ...c, values: [c.values[input.row]] }) } as typeof input.table;
  const sub: PredictInput = { table: row, model: input.model };
  const base = await predictTask(sub, ctx);
  const isCls = blob.target.task !== 'regression';
  const cls = isCls ? (base.proba![0].indexOf(Math.max(...base.proba![0]))) : -1;
  const score = (o: PredictOutput) => (isCls ? o.proba![0][cls] : Number(o.prediction[0]));
  const prediction = base.prediction[0];
  if (!('kind' in blob) && blob.artifact.binary?.pickle && ['xgboost', 'lightgbm'].includes(blob.artifact.pluginId)) {
    const h = ctx.engine<PyHandle>('pyodide');
    const id = h.bridge.load(blob.artifact.binary.pickle);
    try {
      const X = transform(blob.preprocessor, row);
      const raw = h.bridge.contributions(id, X.data, 1, X.cols);
      if (raw) {
        const r = JSON.parse(raw) as { shape: number[]; values: number[] };
        // shape [1, cols+1] or [1, classes, cols+1]
        const width = X.cols + 1;
        const offset = r.shape.length === 3 ? cls * width : 0;
        const contrib = r.values.slice(offset, offset + width);
        const byCol = new Map<string, number>();
        let k = 0;
        for (const st of blob.preprocessor.steps) {
          const n = blob.preprocessor.outputNames.filter((nm) => nm === st.column || nm.startsWith(`${st.column}=`) || nm.startsWith(`${st.column}.`) || nm.startsWith(`${st.column}#`) || nm.startsWith(`${st.column}~`) || nm === `${st.column}__isna`).length;
          byCol.set(st.column, contrib.slice(k, k + n).reduce((a, b) => a + b, 0));
          k += n;
        }
        return { method: 'treeshap', unit: isCls ? 'margin (log-odds)' : 'standardised target', prediction, baseValue: contrib[width - 1],
          items: [...byCol.entries()].map(([feature, contribution]) => ({ feature, value: cellString(getColumn(row, feature), 0), contribution })).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)) };
      }
    } finally { h.bridge.free(id); }
  }
  const prep = 'kind' in blob ? blob.members[0].folds[0].preprocessor : blob.preprocessor;
  const items: ExplainOutput['items'] = [];
  for (const st of prep.steps) {
    const baseline = st.type === 'numeric' ? String(st.fill) : st.type === 'onehot' || st.type === 'ordinal' ? st.categories[0] : null;
    const alt = { ...row, columns: row.columns.map((c) => c.name !== st.column ? c : c.kind === 'numeric' ? { ...c, values: Float64Array.of(baseline === null ? NaN : Number(baseline)) } : { ...c, values: [baseline] }) } as typeof row;
    const o = await predictTask({ table: alt, model: input.model }, ctx);
    items.push({ feature: st.column, value: cellString(getColumn(row, st.column), 0), contribution: score(base) - score(o) });
  }
  return { method: 'perturbation', unit: isCls ? `probability of "${prediction}"` : 'target units', prediction, baseValue: score(base), items: items.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)) };
}
