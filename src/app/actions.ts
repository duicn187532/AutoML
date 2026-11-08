import { encodeBinJson } from '@/core/storage/binjson';
import { modelBlobKey, type ExperimentRecord, type ModelRecord } from '@/core/project/types';
import { getPlugin } from '@/core/models/registry';
import { newId } from '@/core/util/id';
import type { TaskHandle } from '@/core/workers/pool';
import type { TrainConfig, TrainOutput } from '@/core/workers/types';
import { pool } from './services';
import { useProject } from './stores/project';
import { useTasks } from './stores/tasks';

/** Parse a CSV file in a worker and add it to the project. */
export async function importCsvFile(name: string, bytes: ArrayBuffer, source: 'csv' | 'sample' = 'csv') {
  const size = bytes.byteLength;
  const h = pool.submit({ kind: 'parseCsv', input: { bytes, fileName: name } }, { label: `CSV · ${name}`, transfer: [bytes] });
  const { table, warnings } = await h.result;
  return useProject.getState().addDataset(table, {
    name: name.replace(/\.(csv|txt)$/i, ''),
    source: { type: source, fileName: name, bytes: size },
    warnings: warnings.length ? warnings : undefined,
  });
}

export interface TrainRun {
  handle: TaskHandle<TrainOutput>;
  done: Promise<ExperimentRecord>;
}

/** Submit a training task; on completion the experiment (and model) are recorded in the project. */
export async function startTraining(config: TrainConfig, opts: { name?: string; rerunOf?: string } = {}): Promise<TrainRun> {
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
        nTrain: out.nTrain, nValid: out.nValid, durationMs: out.durationMs, modelId, rerunOf: opts.rerunOf, createdAt: started,
      };
      const record: ModelRecord = {
        id: modelId, name, pluginId: config.pluginId, params: out.artifact.params, task: out.task,
        datasetId: config.datasetId, datasetHash: dataset.hash, target: config.target, features: config.features,
        metrics: out.metrics.valid, blobKey: modelBlobKey(modelId), experimentId: expId, createdAt: Date.now(),
      };
      const bytes = encodeBinJson({ artifact: out.artifact, preprocessor: out.preprocessor, target: out.target });
      await useProject.getState().recordExperiment(exp, { record, bytes });
      return exp;
    },
    async (err: Error) => {
      const exp: ExperimentRecord = {
        id: expId, name, status: err?.name === 'CancelledError' ? 'cancelled' : 'failed', config, datasetHash: dataset.hash,
        history: {}, durationMs: Date.now() - started, error: err?.message, rerunOf: opts.rerunOf, createdAt: started,
      };
      await useProject.getState().recordExperiment(exp);
      throw err;
    },
  );
  return { handle, done };
}

/** Re-run an experiment with identical config and seed. */
export function rerunExperiment(exp: ExperimentRecord): Promise<TrainRun> {
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
