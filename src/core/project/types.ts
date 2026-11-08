import type { ColumnProfile } from '../data/table';
import type { MetricSet } from '../ml/metrics';
import type { TaskKind } from '../ml/preprocess';
import type { ParamValues } from '../models/types';
import type { TrainConfig } from '../workers/types';

/**
 * Project data model (persisted as JSON in IndexedDB and as aml-project.json inside the .zip).
 * Large payloads (table columns, model weights) live in blobs referenced by relative `blobKey`s,
 * so a project can be re-keyed on import without rewriting records.
 */
export const PROJECT_FORMAT_VERSION = 1;

export interface Project {
  formatVersion: typeof PROJECT_FORMAT_VERSION;
  id: string;
  name: string;
  /** Default seed for new experiments; every random step derives from an explicit seed. */
  seed: number;
  createdAt: number;
  updatedAt: number;
  appVersion: string;
  datasets: DatasetRecord[];
  pipelines: PipelineRecord[];
  models: ModelRecord[];
  experiments: ExperimentRecord[];
  scripts: ScriptRecord[];
}

export interface DatasetRecord {
  id: string;
  name: string;
  source: { type: 'csv' | 'sample' | 'derived'; fileName?: string; bytes?: number };
  rowCount: number;
  columns: ColumnProfile[];
  /** blob: encoded ColumnarTable */
  blobKey: string;
  /** Content hash of the encoded table = dataset version. */
  hash: string;
  createdAt: number;
  warnings?: string[];
  derivedFrom?: { datasetId: string; pipelineId: string };
}

/** Replayable data-cleaning steps (M2 extends this union). */
export type PipelineStep =
  | { op: 'dropColumns'; columns: string[] }
  | { op: 'setKind'; column: string; kind: ColumnProfile['kind'] }
  | { op: 'dropMissingRows'; columns: string[] };

export interface PipelineRecord {
  id: string;
  name: string;
  inputDatasetId: string;
  steps: PipelineStep[];
  createdAt: number;
}

export interface ModelRecord {
  id: string;
  name: string;
  pluginId: string;
  params: ParamValues;
  task: TaskKind;
  datasetId: string;
  datasetHash: string;
  target: string;
  features: string[];
  metrics: MetricSet;
  /** blob: binary-JSON { artifact, preprocessor, target } */
  blobKey: string;
  experimentId: string;
  createdAt: number;
}

export type ExperimentStatus = 'done' | 'failed' | 'cancelled';

export interface ExperimentRecord {
  id: string;
  name: string;
  status: ExperimentStatus;
  config: TrainConfig;
  datasetHash: string;
  task?: TaskKind;
  metrics?: { train: MetricSet; valid: MetricSet };
  confusion?: number[][];
  classes?: string[];
  roc?: { fpr: number[]; tpr: number[] };
  history: Record<string, number[]>;
  bestEpoch?: number;
  notes?: string[];
  skippedColumns?: { column: string; reason: string }[];
  nTrain?: number;
  nValid?: number;
  durationMs: number;
  modelId?: string;
  error?: string;
  /** Experiment this one re-ran (reproducibility check). */
  rerunOf?: string;
  createdAt: number;
}

export interface ScriptRecord {
  id: string;
  name: string;
  cells: { id: string; source: string }[];
  updatedAt: number;
}

export function emptyProject(id: string, name: string, seed: number, appVersion: string): Project {
  const now = Date.now();
  return {
    formatVersion: PROJECT_FORMAT_VERSION, id, name, seed, createdAt: now, updatedAt: now, appVersion,
    datasets: [], pipelines: [], models: [], experiments: [], scripts: [],
  };
}

export const datasetBlobKey = (datasetId: string) => `dataset/${datasetId}`;
export const modelBlobKey = (modelId: string) => `model/${modelId}`;
