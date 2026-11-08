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
  /** Network-designer graphs (optional for projects saved by older versions). */
  graphs?: GraphRecord[];
}

export interface GraphRecord {
  id: string;
  name: string;
  datasetId?: string;
  graph: import('../dag/graph').Graph;
  updatedAt: number;
}

export interface DatasetRecord {
  id: string;
  name: string;
  source: { type: 'csv' | 'sample' | 'derived' | 'script' | 'images'; fileName?: string; bytes?: number };
  rowCount: number;
  columns: ColumnProfile[];
  /** blob: encoded ColumnarTable */
  blobKey: string;
  /** Content hash of the encoded table = dataset version. */
  hash: string;
  createdAt: number;
  warnings?: string[];
  derivedFrom?: { datasetId: string; pipelineId: string };
  /** Image dataset: table has columns `file` and `label`; JPEG bytes live in this blob (binary-JSON ImagePack). */
  images?: { blobKey: string; count: number };
}

/** Replayable data-cleaning / feature-engineering steps (applied by core/data/ops.ts). */
export type FilterOp = '<' | '<=' | '>' | '>=' | '==' | '!=' | 'in' | 'notin' | 'isna' | 'notna';
export type PipelineStep =
  | { op: 'dropColumns'; columns: string[] }
  | { op: 'renameColumn'; from: string; to: string }
  | { op: 'setKind'; column: string; kind: ColumnProfile['kind'] }
  | { op: 'dropMissingRows'; columns: string[] }
  | { op: 'fillMissing'; column: string; value: string }
  | { op: 'filterRows'; column: string; cmp: FilterOp; value?: string }
  | { op: 'dropDuplicates'; columns: string[] }
  | { op: 'dateExpand'; column: string; parts: ('year' | 'month' | 'day' | 'dow' | 'hour')[]; drop: boolean }
  | { op: 'mathTransform'; column: string; fn: 'log1p' | 'sqrt' | 'abs' | 'square'; output: string }
  | { op: 'interaction'; a: string; b: string; fn: '*' | '/' | '+' | '-'; output: string }
  | { op: 'lag'; column: string; lags: number[]; orderBy?: string; groupBy?: string }
  | { op: 'rolling'; column: string; window: number; stat: 'mean' | 'std' | 'min' | 'max'; orderBy?: string; groupBy?: string };

export interface PipelineRecord {
  id: string;
  name: string;
  inputDatasetId: string;
  steps: PipelineStep[];
  createdAt: number;
  updatedAt?: number;
  /** Dataset produced by the last "save as dataset". */
  outputDatasetId?: string;
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
  sizeBytes?: number;
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
  metrics?: { train: MetricSet; valid: MetricSet; test?: MetricSet; cv?: { folds: MetricSet[]; mean: MetricSet; std: MetricSet } };
  confusion?: number[][];
  validPredictions?: { y: number[]; pred: number[]; proba?: number[][] };
  featureNames?: string[];
  featureImportance?: number[];
  permutation?: { feature: string; mean: number; ci95: number }[];
  nTest?: number;
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
  /** Experiments launched together ("train all") share a batch id. */
  batchId?: string;
  /** Auto-mode run details (config.pluginId === 'auto'). */
  auto?: { preset: string; candidates: import('../workers/types').AutoCandidate[]; ensemble: { id: string; label: string; weight: number }[] };
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
export const imagesBlobKey = (datasetId: string) => `images/${datasetId}`;

export function newPipeline(id: string, dataset: Pick<DatasetRecord, 'id' | 'name'>, steps: PipelineStep[]): PipelineRecord {
  return { id, name: `${dataset.name} pipeline`, inputDatasetId: dataset.id, steps, createdAt: Date.now() };
}
