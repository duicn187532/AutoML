import { encodeBinJson } from '@/core/storage/binjson';
import { modelBlobKey, type ExperimentRecord, type ModelRecord } from '@/core/project/types';
import { getPlugin, listPlugins } from '@/core/models/registry';
import { defaultParams } from '@/core/models/params';
import { DEFAULT_PREPROCESS, type TaskKind } from '@/core/ml/preprocess';
import { autoModelCard } from '@/core/auto/modelCard';
import { gridConfigs, randomConfig, tpeConfig, type SearchDim } from '@/core/auto/search';
import { Rng } from '@/core/rng';
import type { ParamValues } from '@/core/models/types';
import { portfolio, type Preset } from '@/core/auto/portfolio';
import { newId } from '@/core/util/id';
import type { TaskHandle } from '@/core/workers/pool';
import type { AutoOutput, TrainConfig, TrainOutput } from '@/core/workers/types';
import { pool, storage } from './services';
import { toCsv } from '@/core/data/csv';
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
  if (exp.config.pluginId === 'auto') return Promise.reject(new Error('Re-run Auto-mode runs from the Auto module'));
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
