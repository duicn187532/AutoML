import type { PyHandle } from '../../engines/adapters';
import type { PreprocessorState, TargetState } from '../../ml/preprocess';
import type { ModelArtifact } from '../../models/types';
import { decodeBinJson } from '../../storage/binjson';
import { base64ToBytes } from '../../util/base64';
import type { BaggedMember, TaskContext } from '../types';

export interface PortableBundle {
  format: 'aml-portable';
  version: 1;
  task: string;
  target: { column: string; classes?: string[]; mean?: number; std?: number };
  /** raw feature columns the predictor asks for */
  features: { name: string; kind: 'numeric' | 'categorical' | 'datetime'; categories?: string[] }[];
  members: { weight: number; prep: PreprocessorState; model: unknown }[];
}

interface Layer { class_name: string; config: { name: string; activation?: string } }

function mlpToPortable(a: ModelArtifact) {
  const p = a.payload as { modelTopology: { config: { layers: Layer[] } | Layer[] }; weightSpecs: { name: string; shape: number[] }[]; weightsBase64: string };
  const bytes = base64ToBytes(p.weightsBase64);
  const f32 = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  const byName = new Map<string, Float32Array>();
  let off = 0;
  for (const s of p.weightSpecs) { const n = s.shape.reduce((x, y) => x * y, 1); byName.set(s.name, f32.subarray(off, off + n)); off += n; }
  const cfg = p.modelTopology.config as { layers?: Layer[] } | Layer[];
  const layersCfg = Array.isArray(cfg) ? cfg : cfg.layers ?? [];
  const layers: { W: number[][]; b: number[]; activation: string }[] = [];
  let pendingAct: string | null = null;
  for (const l of layersCfg) {
    if (l.class_name === 'Dense') {
      const kName = [...byName.keys()].find((k) => k.startsWith(`${l.config.name}/kernel`))!;
      const bName = [...byName.keys()].find((k) => k.startsWith(`${l.config.name}/bias`))!;
      const spec = p.weightSpecs.find((s) => s.name === kName)!;
      const [din, dout] = spec.shape, K = byName.get(kName)!;
      layers.push({ W: Array.from({ length: din }, (_, i) => Array.from(K.subarray(i * dout, (i + 1) * dout))), b: Array.from(byName.get(bName)!), activation: l.config.activation ?? 'linear' });
    } else if (l.class_name === 'Activation') pendingAct = l.config.activation ?? null;
    if (pendingAct && layers.length) { layers[layers.length - 1].activation = pendingAct; pendingAct = null; }
  }
  if (layers.some((l) => l.activation === 'gelu')) throw new Error('GELU MLPs are not exportable yet');
  return { kind: 'mlp', layers };
}

/** Raw input columns (and known categories) the predictor form should ask for. */
function featuresOf(prep: PreprocessorState): PortableBundle['features'] {
  return prep.steps.map((st) => st.type === 'numeric' ? { name: st.column, kind: 'numeric' as const }
    : st.type === 'datetime' ? { name: st.column, kind: 'datetime' as const }
    : st.type === 'tfidf' ? { name: st.column, kind: 'categorical' as const }
    : { name: st.column, kind: 'categorical' as const, categories: st.type === 'onehot' || st.type === 'ordinal' ? st.categories.filter((c) => c !== '__missing__') : st.type === 'target' ? Object.keys(st.table).filter((c) => c !== '__missing__') : undefined });
}

async function toPortable(a: ModelArtifact, ctx: TaskContext): Promise<unknown> {
  if (a.pluginId === 'logistic') {
    const p = a.payload as { W: number[]; b: number[] };
    const k = a.nClasses, d = a.nFeatures;
    return { kind: 'linear', classifier: true, classes: [], W: Array.from({ length: d }, (_, j) => p.W.slice(j * k, (j + 1) * k)), b: p.b };
  }
  if (a.pluginId === 'ridge') {
    const p = a.payload as { w: number[]; b: number };
    return { kind: 'linear', classifier: false, classes: [], W: p.w.map((v) => [v]), b: [p.b] };
  }
  if (a.pluginId === 'mlp') return mlpToPortable(a);
  if (a.binary?.pickle) {
    const h = ctx.engine<PyHandle>('pyodide');
    const id = h.bridge.load(a.binary.pickle);
    try {
      const json = h.bridge.export_portable(id);
      if (!json) throw new Error(`${a.pluginId} has no portable (JavaScript) form — use the Python export instead`);
      return JSON.parse(json);
    } finally {
      h.bridge.free(id);
    }
  }
  throw new Error(`${a.pluginId} cannot be exported`);
}

/** Convert a stored model (single or bagged ensemble) into the dependency-free portable bundle. */
export async function exportPortableTask(input: { model: Uint8Array }, ctx: TaskContext): Promise<PortableBundle> {
  const blob = decodeBinJson<{ artifact: ModelArtifact; preprocessor: PreprocessorState; target: TargetState } | { kind: 'bagged-ensemble'; task: string; target: TargetState; members: BaggedMember[] }>(input.model);
  const target = blob.target;
  const parts = 'kind' in blob
    ? blob.members.flatMap((m) => m.folds.map((f) => ({ weight: m.weight / m.folds.length, art: f.artifact, prep: f.preprocessor })))
    : [{ weight: 1, art: blob.artifact, prep: blob.preprocessor }];
  const members: PortableBundle['members'] = [];
  for (const [i, p] of parts.entries()) {
    members.push({ weight: p.weight, prep: p.prep, model: await toPortable(p.art, ctx) });
    ctx.progress({ fraction: (i + 1) / parts.length });
  }
  return {
    format: 'aml-portable', version: 1, task: target.task,
    target: target.task === 'regression' ? { column: target.column, mean: target.mean, std: target.std } : { column: target.column, classes: target.classes },
    features: featuresOf(parts[0].prep), members,
  };
}
