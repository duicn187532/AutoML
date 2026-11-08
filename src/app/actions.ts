import { decodeBinJson, encodeBinJson } from '@/core/storage/binjson';
import { strToU8, zipSync } from 'fflate';
import { htmlPredictor } from '@/core/export/htmlPredictor';
import { experimentModelCard } from '@/core/export/modelCard';
import runtimeSource from '@/core/export/runtime.js?raw';
import type { PortableBundle } from '@/core/workers/tasks/exportPortable';
import { base64ToBytes } from '@/core/util/base64';
import { modelBlobKey, type ExperimentRecord, type GraphRecord, type ModelRecord } from '@/core/project/types';
import { getPlugin, listPlugins, pluginName } from '@/core/models/registry';
import { defaultParams } from '@/core/models/params';
import { DEFAULT_PREPROCESS, type TaskKind } from '@/core/ml/preprocess';
import { autoModelCard } from '@/core/auto/modelCard';
import { gridConfigs, randomConfig, tpeConfig, type SearchDim } from '@/core/auto/search';
import { Rng } from '@/core/rng';
import type { ModelArtifact, ParamValues } from '@/core/models/types';
import { portfolio, type Preset } from '@/core/auto/portfolio';
import { newId } from '@/core/util/id';
import type { TaskHandle } from '@/core/workers/pool';
import type { AutoOutput, ImageModelArtifact, TrainConfig, TrainGraphOutput, TrainImageInput, TrainImageOutput, TrainOutput } from '@/core/workers/types';
import { pool, storage } from './services';
import { safeFileName } from '@/core/security/escape';
import { toCsv } from '@/core/data/csv';
import type { ColumnarTable } from '@/core/data/table';
import { experimentToPython } from '@/core/export/python';
import { modelEngines } from '@/core/workers/tasks/predict';
import type { EngineName } from '@/core/models/types';
import { detectFormat } from '@/core/data/formats';
import { useProject } from './stores/project';
import { useTasks } from './stores/tasks';

/** Parse a data file (CSV / JSON / Excel / Parquet) in a worker and add it to the project. */
export async function importCsvFile(name: string, bytes: ArrayBuffer, source: 'csv' | 'sample' = 'csv') {
  const size = bytes.byteLength;
  const fmt = detectFormat(name);
  const h = pool.submit({ kind: 'parseCsv', input: { bytes, fileName: name } }, { label: `${fmt.toUpperCase()} · ${name}`, transfer: [bytes], engines: fmt === 'xlsx' ? ['xlsx'] : [] });
  const { table, warnings } = await h.result;
  return useProject.getState().addDataset(table, {
    name: name.replace(/\.(csv|tsv|txt|json|jsonl|ndjson|xlsx|xls|xlsm|ods|parquet|pq)$/i, ''),
    source: { type: source, fileName: name, bytes: size },
    warnings: warnings.length ? warnings : undefined,
  });
}

export interface TrainRun {
  handle: TaskHandle<TrainOutput>;
  done: Promise<ExperimentRecord>;
}

/** Submit a training task; on completion the experiment (and model) are recorded in the project. */
export async function startTraining(config: TrainConfig, opts: { name?: string; rerunOf?: string; batchId?: string } = {}): Promise<TrainRun> {
  const store = useProject.getState();
  const project = store.project!;
  const dataset = project.datasets.find((d) => d.id === config.datasetId);
  if (!dataset) throw new Error('Dataset not found');
  const plugin = getPlugin(config.pluginId);
  const table = await store.getTable(config.datasetId);
  const label = `${plugin.name.en} · ${dataset.name} → ${config.target}`;
  const handle = pool.submit(
    { kind: 'train', input: { table, config } },
    {
      label,
      engines: plugin.engines,
      onProgress: (p) => { if (p.point) useTasks.getState().addPoint(handle.id, p.point); },
    },
  );
  const started = Date.now();
  const expId = newId('e');
  const name = opts.name ?? `${plugin.id}-${project.experiments.length + 1}`;
  const done = handle.result.then(
    async (out) => {
      const modelId = newId('m');
      const exp: ExperimentRecord = {
        id: expId, name, status: 'done', config, datasetHash: dataset.hash, task: out.task,
        metrics: out.metrics, confusion: out.confusion, roc: out.roc,
        classes: out.target.task === 'regression' ? undefined : out.target.classes,
        history: out.history, bestEpoch: out.bestEpoch, notes: out.notes, skippedColumns: out.preprocessor.skipped,
        nTrain: out.nTrain, nValid: out.nValid, nTest: out.nTest, validPredictions: out.validPredictions,
        featureNames: out.featureNames, featureImportance: out.featureImportance, permutation: out.permutation, durationMs: out.durationMs, modelId, rerunOf: opts.rerunOf, batchId: opts.batchId, createdAt: started,
      };
      const record: ModelRecord = {
        id: modelId, name, pluginId: config.pluginId, params: out.artifact.params, task: out.task,
        datasetId: config.datasetId, datasetHash: dataset.hash, target: config.target, features: config.features,
        metrics: out.metrics.valid, blobKey: modelBlobKey(modelId), experimentId: expId, createdAt: Date.now(),
      };
      const bytes = encodeBinJson({ artifact: out.artifact, preprocessor: out.preprocessor, target: out.target });
      record.sizeBytes = bytes.byteLength;
      await useProject.getState().recordExperiment(exp, { record, bytes });
      return exp;
    },
    async (err: Error) => {
      const exp: ExperimentRecord = {
        id: expId, name, status: err?.name === 'CancelledError' ? 'cancelled' : 'failed', config, datasetHash: dataset.hash,
        history: {}, durationMs: Date.now() - started, error: err?.message, rerunOf: opts.rerunOf, batchId: opts.batchId, createdAt: started,
      };
      await useProject.getState().recordExperiment(exp);
      throw err;
    },
  );
  return { handle, done };
}

/** Re-run an experiment with identical config and seed. */
export function rerunExperiment(exp: ExperimentRecord): Promise<TrainRun> {
  if (exp.config.pluginId === 'auto' || exp.config.pluginId === 'dag' || exp.config.pluginId === 'image') return Promise.reject(new Error('Re-run this experiment from its own module (Auto / Network designer)'));
  return startTraining(exp.config, { name: `${exp.name}-rerun`, rerunOf: exp.id });
}

export function downloadBytes(bytes: Uint8Array | string, fileName: string, mime = 'application/octet-stream') {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "Train all": every compatible plugin with its defaults, same data / split / seed. */
export async function trainAll(base: Omit<TrainConfig, 'pluginId' | 'params'>, task: TaskKind): Promise<{ batchId: string; runs: TrainRun[] }> {
  const batchId = newId('b');
  const plugins = listPlugins(task);
  const runs: TrainRun[] = [];
  for (const p of plugins) {
    runs.push(await startTraining({ ...base, pluginId: p.id, params: defaultParams(p, task) }, { name: `${p.id}`, batchId }));
  }
  return { batchId, runs };
}

/** Run AutoML in a worker and record the ensemble as an experiment + model. */
export async function runAuto(opts: { datasetId: string; target: string; features: string[]; task: TaskKind; preset: Preset; timeBudgetSec: number; testFraction: number; seed: number },
  onStart: (taskId: string) => void): Promise<{ out: AutoOutput; card: string; expId: string }> {
  const store = useProject.getState();
  const project = store.project!;
  const dataset = project.datasets.find((d) => d.id === opts.datasetId)!;
  const table = await store.getTable(dataset.id);
  const entries = portfolio(opts.preset, opts.task, dataset.rowCount);
  const engines = [...new Set(entries.flatMap((e) => getPlugin(e.pluginId).engines))];
  const started = Date.now();
  const h = pool.submit(
    { kind: 'auto', input: { table, target: opts.target, features: opts.features, task: opts.task, preset: opts.preset, timeBudgetSec: opts.timeBudgetSec, seed: opts.seed, testFraction: dataset.rowCount >= 200 ? opts.testFraction : 0 } },
    { label: `AutoML · ${dataset.name} → ${opts.target}`, engines, onProgress: (p) => { if (p.point) useTasks.getState().addPoint(h.id, p.point); } },
  );
  onStart(h.id);
  const out = await h.result;
  const card = autoModelCard(out, { project: project.name, dataset: dataset.name, datasetHash: dataset.hash, target: opts.target, features: opts.features, preset: opts.preset, seed: opts.seed, rows: dataset.rowCount });
  const expId = newId('e'), modelId = newId('m');
  const exp: ExperimentRecord = {
    id: expId, name: `auto-${opts.preset}-${project.experiments.length + 1}`, status: 'done',
    config: { datasetId: dataset.id, target: opts.target, features: opts.features, task: opts.task, pluginId: 'auto', params: { preset: opts.preset, timeBudgetSec: opts.timeBudgetSec }, seed: opts.seed, validFraction: 0, preprocess: DEFAULT_PREPROCESS },
    datasetHash: dataset.hash, task: out.task, metrics: { train: {}, valid: out.ensemble.oof, test: out.ensemble.test },
    classes: out.target.task === 'regression' ? undefined : out.target.classes,
    history: { epoch: out.ensemble.lossHistory.map((_, i) => i + 1), loss: out.ensemble.lossHistory },
    notes: [card], nTrain: out.nDev, nValid: out.nDev, nTest: out.nTest, durationMs: out.durationMs, modelId, createdAt: started,
    auto: { preset: opts.preset, candidates: out.candidates, ensemble: out.ensemble.weights },
  };
  const model: ModelRecord = {
    id: modelId, name: exp.name, pluginId: 'auto', params: exp.config.params, task: out.task, datasetId: dataset.id, datasetHash: dataset.hash,
    target: opts.target, features: opts.features, metrics: out.ensemble.oof, blobKey: modelBlobKey(modelId), sizeBytes: out.bundle.byteLength, experimentId: expId, createdAt: Date.now(),
  };
  await useProject.getState().recordExperiment(exp, { record: model, bytes: out.bundle });
  return { out, card, expId };
}

/** Batch prediction with a stored model; returns CSV text (RFC 4180, formula-guarded, BOM for Excel). */
export async function predictToCsv(modelId: string, datasetId: string, idColumn?: string): Promise<{ csv: string; rows: number; preview: (string | number)[][]; header: string[] }> {
  const store = useProject.getState();
  const project = store.project!;
  const model = project.models.find((m) => m.id === modelId)!;
  const bytes = await storage.getBlob(project.id, model.blobKey);
  if (!bytes) throw new Error('Model data missing from browser storage');
  const table = await store.getTable(datasetId);
  const engines = modelEngines(bytes) as EngineName[];
  const out = await pool.submit({ kind: 'predict', input: { table, model: bytes, idColumn } }, { label: `predict · ${model.name}`, engines }).result;
  const header = [...(out.ids ? [idColumn!] : []), `${model.target}_pred`, ...(out.classes ?? []).map((c) => `p(${c})`)];
  const rows = out.prediction.map((p, i) => [...(out.ids ? [out.ids[i] ?? ''] : []), p, ...(out.proba?.[i].map((x) => +x.toFixed(6)) ?? [])]);
  return { csv: toCsv(header, rows, { bom: true, guardFormulas: true }), rows: rows.length, preview: rows.slice(0, 20), header };
}

export type SearchMethod = 'grid' | 'random' | 'tpe';

/**
 * Hyper-parameter search: each trial is a normal experiment (same split / seed) in one batch.
 * TPE proposes sequentially from finished trials; trials run `parallel` at a time.
 */
export async function searchParams(base: TrainConfig, dims: SearchDim[], method: SearchMethod, trials: number, onBatch: (batchId: string) => void): Promise<string> {
  const batchId = newId('s');
  onBatch(batchId);
  const rng = new Rng(base.seed ^ 0x5eed);
  const cls = base.task !== 'regression';
  const lossOf = (e: ExperimentRecord) => (cls ? e.metrics?.valid.logLoss : e.metrics?.valid.rmse) ?? Infinity;
  const history: { params: ParamValues; loss: number }[] = [];
  const grid = method === 'grid' ? gridConfigs(dims, trials) : [];
  const total = method === 'grid' ? grid.length : trials;
  const parallel = 2;
  let next = 0;
  const runOne = async (i: number) => {
    const proposal = method === 'grid' ? grid[i] : method === 'random' ? randomConfig(dims, rng.fork(`r${i}`)) : tpeConfig(dims, history, rng.fork(`t${i}`));
    const params = { ...base.params, ...proposal };
    try {
      const run = await startTraining({ ...base, params }, { name: `${base.pluginId}-${method}-${i + 1}`, batchId });
      const exp = await run.done;
      history.push({ params, loss: lossOf(exp) });
    } catch {
      history.push({ params, loss: Infinity });
    }
  };
  const worker = async () => { for (let i = next++; i < total; i = next++) await runOne(i); };
  await Promise.all(Array.from({ length: parallel }, worker));
  return batchId;
}

const SCRIPT_ENGINES: EngineName[] = ['pyodide', 'py-sklearn', 'py-stats', 'py-plot'];

/** Run one script cell; datasets referenced as aml.load('name') are sent along. */
export async function runScriptCell(session: string, code: string, reset = false) {
  const store = useProject.getState();
  const project = store.project!;
  const names = [...code.matchAll(/aml\.load\(\s*(['"])(.+?)\1\s*\)/g)].map((m) => m[2]);
  const tables: Record<string, ColumnarTable> = {};
  for (const n of new Set(names)) {
    const d = project.datasets.find((x) => x.name === n);
    if (d) tables[n] = await store.getTable(d.id);
  }
  const out = await pool.submit({ kind: 'pyRun', input: { session, code, tables, reset } }, { label: 'script cell', engines: SCRIPT_ENGINES }).result;
  for (const s of out.saved) await store.addDataset(s.table, { name: s.name, source: { type: 'script' } });
  return out;
}

/** "Copy as code": append an experiment's Python reproduction to the project's first script. */
export function copyExperimentToScript(exp: ExperimentRecord): void {
  const store = useProject.getState();
  const project = store.project!;
  const ds = project.datasets.find((d) => d.id === exp.config.datasetId);
  if (!ds) throw new Error('Dataset not found');
  const code = experimentToPython(exp, ds, 'workbench');
  const script = project.scripts[0] ?? { id: newId('s'), name: 'Script 1', cells: [], updatedAt: Date.now() };
  store.upsertScript({ ...script, cells: [...script.cells, { id: newId('c'), source: code }], updatedAt: Date.now() });
}

/** M8: standalone Python reproduction of an experiment (reads <dataset>.csv). */
export function downloadPython(exp: ExperimentRecord): void {
  const project = useProject.getState().project!;
  const ds = project.datasets.find((d) => d.id === exp.config.datasetId);
  if (!ds) throw new Error('Dataset not found');
  downloadBytes(experimentToPython(exp, ds, 'standalone'), `${safeFileName(exp.name)}.py`, 'text/x-python');
}

/** Train a network-designer graph (end-to-end or two-stage) and record it as an experiment. */
export async function trainGraph(rec: GraphRecord, datasetId: string, features: string[],
  s: { epochs: number; batchSize: number; learningRate: number; patience: number; validFraction: number; seed: number },
  mode: 'end-to-end' | 'two-stage', onStart: (id: string) => void): Promise<TrainGraphOutput> {
  const store = useProject.getState();
  const project = store.project!;
  const dataset = project.datasets.find((d) => d.id === datasetId)!;
  const table = await store.getTable(datasetId);
  const expertPlugins = rec.graph.nodes.filter((n) => n.type === 'expert' && n.params.model !== 'neural').map((n) => String(n.params.model));
  const engines: EngineName[] = ['tfjs', ...(mode === 'two-stage' ? [...new Set(expertPlugins.flatMap((p) => getPlugin(p).engines))] : [])];
  const started = Date.now();
  const h = pool.submit({ kind: 'trainGraph', input: { table, graph: rec.graph, features, seed: s.seed, validFraction: s.validFraction, epochs: s.epochs, batchSize: s.batchSize, learningRate: s.learningRate, patience: s.patience } },
    { label: `${rec.name} · ${dataset.name}`, engines, onProgress: (p) => { if (p.point) useTasks.getState().addPoint(h.id, p.point); } });
  onStart(h.id);
  const out = await h.result;
  const head = out.heads[0];
  const expId = newId('e'), modelId = newId('m');
  const bytes = encodeBinJson(out.artifact);
  const exp: ExperimentRecord = {
    id: expId, name: `${rec.name}-${project.experiments.length + 1}`, status: 'done',
    config: { datasetId, target: head.target, features, task: head.task, pluginId: 'dag', params: { graphId: rec.id, ...s }, seed: s.seed, validFraction: s.validFraction, preprocess: DEFAULT_PREPROCESS },
    datasetHash: dataset.hash, task: head.task, metrics: { train: {}, valid: out.metrics[head.node] ?? {} }, classes: head.classes,
    history: out.history, notes: out.notes, nTrain: out.nTrain, nValid: out.nValid, durationMs: out.durationMs, modelId, createdAt: started,
  };
  const model: ModelRecord = { id: modelId, name: exp.name, pluginId: 'dag', params: exp.config.params, task: head.task, datasetId, datasetHash: dataset.hash, target: head.target, features,
    metrics: exp.metrics!.valid, blobKey: modelBlobKey(modelId), sizeBytes: bytes.byteLength, experimentId: expId, createdAt: Date.now() };
  await store.recordExperiment(exp, { record: model, bytes });
  return out;
}

async function modelBytes(exp: ExperimentRecord) {
  const project = useProject.getState().project!;
  const model = project.models.find((m) => m.id === exp.modelId);
  if (!model) throw new Error('This experiment has no stored model');
  const bytes = await storage.getBlob(project.id, model.blobKey);
  if (!bytes) throw new Error('Model data missing from browser storage');
  return { model, bytes };
}

/** M8: portable bundle (JSON) — the input to the HTML predictor and the embeddable JS runtime. */
export async function exportPortable(exp: ExperimentRecord): Promise<PortableBundle> {
  const { model, bytes } = await modelBytes(exp);
  return pool.submit({ kind: 'exportPortable', input: { model: bytes } }, { label: `export · ${model.name}`, engines: modelEngines(bytes) as EngineName[] }).result;
}

export function experimentCard(exp: ExperimentRecord): string {
  const project = useProject.getState().project!;
  return experimentModelCard(exp, project.datasets.find((d) => d.id === exp.config.datasetId), pluginName(exp.config.pluginId).en, project.name);
}

export async function downloadHtmlPredictor(exp: ExperimentRecord) {
  const bundle = await exportPortable(exp);
  downloadBytes(htmlPredictor(bundle, `${exp.name} — ${exp.config.target}`, experimentCard(exp)), `${safeFileName(exp.name)}-predictor.html`, 'text/html');
}

export async function downloadPortableJson(exp: ExperimentRecord) {
  const bundle = await exportPortable(exp);
  downloadBytes(zipSync({
    'model.json': strToU8(JSON.stringify(bundle)),
    'aml-runtime.js': strToU8(runtimeSource),
    'README.txt': strToU8('import { amlPredict } from "./aml-runtime.js";\nconst bundle = await (await fetch("model.json")).json();\nconsole.log(amlPredict(bundle, { column: value, ... }));\n'),
  }), `${safeFileName(exp.name)}-model-js.zip`, 'application/zip');
}

/** TF.js LayersModel format (model.json + weights.bin) for MLP experiments. */
export async function downloadTfjs(exp: ExperimentRecord) {
  const { bytes } = await modelBytes(exp);
  const blob = decodeBinJson<{ artifact: ModelArtifact }>(bytes);
  if (blob.artifact?.pluginId !== 'mlp') throw new Error('TF.js export is available for MLP models');
  const p = blob.artifact.payload as { modelTopology: unknown; weightSpecs: unknown[]; weightsBase64: string };
  const modelJson = { format: 'layers-model', generatedBy: 'AutoML Workbench', convertedBy: null, modelTopology: p.modelTopology, weightsManifest: [{ paths: ['weights.bin'], weights: p.weightSpecs }] };
  downloadBytes(zipSync({ 'model.json': strToU8(JSON.stringify(modelJson)), 'weights.bin': base64ToBytes(p.weightsBase64), 'preprocessing.json': strToU8(JSON.stringify(decodeBinJson<{ preprocessor: unknown; target: unknown }>(bytes), (k, v) => (k === 'artifact' ? undefined : v))) }), `${safeFileName(exp.name)}-tfjs.zip`, 'application/zip');
}

/** Import image files (folder upload: class = sub-folder name) as an image dataset. */
export async function importImages(files: File[], name: string, intoDatasetId?: string, forceLabel?: string | null) {
  const imgs = files.filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|bmp|gif)$/i.test(f.name));
  if (!imgs.length) throw new Error('No image files found');
  const payload = await Promise.all(imgs.map(async (f) => ({ path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, bytes: await f.arrayBuffer() })));
  const out = await pool.submit({ kind: 'importImages', input: { files: payload, maxSide: 256 } }, { label: `images · ${name}`, transfer: payload.map((p) => p.bytes) }).result;
  const store = useProject.getState();
  const labels = forceLabel !== undefined ? out.labels.map(() => forceLabel) : out.labels;
  if (intoDatasetId) {
    const ds = store.project!.datasets.find((d) => d.id === intoDatasetId)!;
    const pack = await store.getImages(intoDatasetId);
    const table = await store.getTable(intoDatasetId);
    const old = getColumnValues(table, 'label');
    return store.saveImageDataset(intoDatasetId, ds.name, { names: [...pack.names, ...out.names], data: [...pack.data, ...out.data] }, [...old, ...labels]);
  }
  return store.saveImageDataset(null, name, { names: out.names, data: out.data }, labels);
}

function getColumnValues(table: ColumnarTable, name: string): (string | null)[] {
  const c = table.columns.find((x) => x.name === name);
  return c && c.kind !== 'numeric' ? [...c.values] : new Array(table.rowCount).fill(null);
}

/** Update labels (labeling tool). */
export async function setImageLabels(datasetId: string, labels: (string | null)[]) {
  const store = useProject.getState();
  const ds = store.project!.datasets.find((d) => d.id === datasetId)!;
  return store.saveImageDataset(datasetId, ds.name, await store.getImages(datasetId), labels);
}

export type ImageTrainSettings = Omit<TrainImageInput, 'pack' | 'labels'>;

/** Train an image classifier; recorded as an experiment with the image model as artifact. */
export async function trainImageModel(datasetId: string, s: ImageTrainSettings, onStart?: (id: string) => void): Promise<{ out: TrainImageOutput; expId: string }> {
  const store = useProject.getState();
  const project = store.project!;
  const ds = project.datasets.find((d) => d.id === datasetId)!;
  const pack = await store.getImages(datasetId);
  const labels = getColumnValues(await store.getTable(datasetId), 'label');
  const engines: EngineName[] = ['tfjs', ...(s.mode === 'scratch' ? [] : [s.backbone as EngineName])];
  const started = Date.now();
  const h = pool.submit({ kind: 'trainImage', input: { ...s, pack, labels } }, { label: `${s.mode === 'scratch' ? 'CNN' : s.backbone} · ${ds.name}`, engines, onProgress: (p) => { if (p.point) useTasks.getState().addPoint(h.id, p.point); } });
  onStart?.(h.id);
  const out = await h.result;
  const expId = newId('e'), modelId = newId('m');
  const bytes = encodeBinJson(out.artifact);
  const params = { mode: s.mode, backbone: s.backbone, epochs: s.epochs, learningRate: s.learningRate, unfreeze: s.unfreeze, imageSize: s.imageSize };
  const exp: ExperimentRecord = {
    id: expId, name: `${s.mode === 'scratch' ? 'cnn' : `${s.backbone}-${s.mode}`}-${project.experiments.length + 1}`, status: 'done',
    config: { datasetId, target: 'label', features: ['image'], task: out.classes.length === 2 ? 'binary' : 'multiclass', pluginId: 'image', params, seed: s.seed, validFraction: s.validFraction, preprocess: DEFAULT_PREPROCESS },
    datasetHash: ds.hash, task: out.classes.length === 2 ? 'binary' : 'multiclass', metrics: { train: {}, valid: out.metrics }, confusion: out.confusion, classes: out.classes,
    history: out.history, notes: [`latency ${out.latencyMs.toFixed(1)} ms / image`], nTrain: out.nTrain, nValid: out.nValid, durationMs: out.durationMs, modelId, createdAt: started,
  };
  const model: ModelRecord = { id: modelId, name: exp.name, pluginId: 'image', params, task: exp.task!, datasetId, datasetHash: ds.hash, target: 'label', features: ['image'],
    metrics: out.metrics, blobKey: modelBlobKey(modelId), sizeBytes: bytes.byteLength, experimentId: expId, createdAt: Date.now() };
  await store.recordExperiment(exp, { record: model, bytes });
  return { out, expId };
}

export async function predictImages(modelId: string, files: Blob[]): Promise<{ classes: string[]; proba: number[][] }> {
  const project = useProject.getState().project!;
  const m = project.models.find((x) => x.id === modelId)!;
  const artifact = decodeBinJson<ImageModelArtifact>((await storage.getBlob(project.id, m.blobKey))!);
  const images = await Promise.all(files.map(async (f) => new Uint8Array(await f.arrayBuffer())));
  const engines: EngineName[] = ['tfjs', ...(artifact.backbone === 'scratch' ? [] : [artifact.backbone as EngineName])];
  const r = await pool.submit({ kind: 'predictImage', input: { artifact, images } }, { label: `predict · ${m.name}`, engines }).result;
  return { classes: artifact.classes, proba: r.proba };
}
