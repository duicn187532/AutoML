import type { ColumnarTable } from '../data/table';
import type { DataProfile } from '../data/explore';
import type { StepLog } from '../data/ops';
import type { PipelineStep } from '../project/types';
import type { MetricSet } from '../ml/metrics';
import type { PreprocessConfig, PreprocessorState, TargetState, TaskKind } from '../ml/preprocess';
import type { SplitConfig } from '../ml/split';
import type { EngineName, ModelArtifact, ParamValues } from '../models/types';

/** Progress message from worker to main (throttled except for curve points). */
export interface TaskProgress {
  fraction?: number;
  message?: string;
  point?: Record<string, number>;
}

/** Worker-side context handed to every task handler. Testable without a real Worker. */
export interface TaskContext {
  progress(p: TaskProgress): void;
  checkpoint(): Promise<void>;
  isCancelled(): boolean;
  engine<T = unknown>(name: EngineName): T;
}

export interface ParseCsvInput {
  bytes: ArrayBuffer;
  fileName: string;
  /** Excel: sheet to import (default: first). */
  sheet?: string;
}
export interface ParseCsvOutput {
  table: ColumnarTable;
  warnings: string[];
  sheets?: string[];
}

export interface TrainConfig {
  datasetId: string;
  target: string;
  features: string[];
  /** undefined = infer from target */
  task?: TaskKind;
  pluginId: string;
  params: ParamValues;
  seed: number;
  /** Legacy shorthand for split.validFraction (hold-out). */
  validFraction: number;
  split?: SplitConfig;
  preprocess: PreprocessConfig;
}

export interface TrainInput {
  table: ColumnarTable;
  config: TrainConfig;
}

export interface TrainOutput {
  task: TaskKind;
  target: TargetState;
  preprocessor: PreprocessorState;
  metrics: {
    train: MetricSet;
    valid: MetricSet;
    /** Evaluated once on the untouched test rows. */
    test?: MetricSet;
    /** k-fold: per-fold validation metrics and their mean / std. */
    cv?: { folds: MetricSet[]; mean: MetricSet; std: MetricSet };
  };
  /** Validation predictions (for residual plots / threshold tuning). */
  validPredictions?: { y: number[]; pred: number[]; proba?: number[][] };
  featureNames: string[];
  featureImportance?: number[];
  /** Permutation importance on raw columns (validation rows): mean score drop ± 95% CI. */
  permutation?: { feature: string; mean: number; ci95: number }[];
  confusion?: number[][];
  roc?: { fpr: number[]; tpr: number[] };
  history: Record<string, number[]>;
  bestEpoch?: number;
  notes: string[];
  artifact: ModelArtifact;
  nTrain: number;
  nValid: number;
  nTest: number;
  durationMs: number;
}

export interface SleepInput {
  steps: number;
  stepMs: number;
  /** Simulate a non-cooperative task that never yields (tests hard cancel). */
  blocking?: boolean;
}

export interface BenchmarkInput {
  pluginId: string;
  rows: number;
  cols: number;
  task: TaskKind;
  params?: ParamValues;
  seed?: number;
  tfBackend?: 'cpu' | 'webgl' | 'webgpu' | 'wasm';
}
export interface BenchmarkOutput {
  pluginId: string;
  rows: number;
  cols: number;
  task: TaskKind;
  fitMs: number;
  predictMs: number;
  wasmHeapMB?: number;
  tfBackend?: string;
}

export interface AutoInput {
  table: ColumnarTable;
  target: string;
  features: string[];
  task?: TaskKind;
  preset: 'fast' | 'balanced' | 'best';
  timeBudgetSec: number;
  seed: number;
  testFraction: number;
  folds?: number;
}

export interface AutoCandidate {
  id: string;
  label: string;
  pluginId: string;
  params: ParamValues;
  source: 'portfolio' | 'search';
  foldMetrics: MetricSet[];
  foldsDone: number;
  cv?: { mean: MetricSet; std: MetricSet };
  test?: MetricSet;
  /** log loss (classification) or RMSE (regression), CV mean */
  loss: number;
  fitMs: number;
  predictMsPer1k?: number;
  sizeBytes?: number;
  weight?: number;
  error?: string;
}

/** One ensemble member: k fold models, each with the preprocessing fitted on its fold. */
export interface BaggedMember {
  pluginId: string;
  params: ParamValues;
  weight: number;
  folds: { preprocessor: PreprocessorState; artifact: ModelArtifact }[];
}

export interface AutoOutput {
  task: TaskKind;
  target: TargetState;
  validation: { kind: 'kfold' | 'holdout'; folds: number };
  nDev: number;
  nTest: number;
  candidates: AutoCandidate[];
  ensemble: { weights: { id: string; label: string; weight: number }[]; oof: MetricSet; test?: MetricSet; lossHistory: number[] };
  /** binary-JSON { kind: 'bagged-ensemble', task, target, members } */
  bundle: Uint8Array;
  durationMs: number;
}

export interface PredictInput {
  table: ColumnarTable;
  /** Stored model blob (binary JSON). */
  model: Uint8Array;
  idColumn?: string;
}
export interface PredictOutput {
  task: TaskKind;
  prediction: (string | number)[];
  proba?: number[][];
  classes?: string[];
  ids?: (string | null)[];
}

export interface PyRunInput {
  session: string;
  code: string;
  /** Datasets referenced by the cell (aml.load('name')), by name. */
  tables?: Record<string, ColumnarTable>;
  reset?: boolean;
}
export interface PyRunOutput {
  stdout: string;
  stderr: string;
  result: string | null;
  error: string | null;
  /** base64 PNGs of matplotlib figures */
  images: string[];
  saved: { name: string; table: ColumnarTable }[];
  durationMs: number;
}

export interface TrainGraphInput {
  table: ColumnarTable;
  graph: import('../dag/graph').Graph;
  features: string[];
  seed: number;
  validFraction: number;
  epochs: number;
  batchSize: number;
  learningRate: number;
  patience: number;
}
export interface GateStats {
  meanWeight: number[];
  /** share of validation samples whose largest weight goes to each expert */
  share: number[];
  /** features (standardised means) that distinguish each expert's samples */
  topFeatures: { name: string; z: number }[][];
}
export interface TrainGraphOutput {
  mode: 'end-to-end' | 'two-stage';
  metrics: Record<string, MetricSet>;
  heads: { node: string; target: string; task: TaskKind; classes?: string[] }[];
  gates: Record<string, GateStats>;
  experts?: { node: string; pluginId: string; metrics: MetricSet; fitMs: number }[];
  history: Record<string, number[]>;
  notes: string[];
  totalParams: number;
  nTrain: number;
  nValid: number;
  artifact: { graph: import('../dag/graph').Graph; preprocessor: PreprocessorState; targets: Record<string, TargetState>; weights: { shape: number[]; data: number[] }[] };
  durationMs: number;
}

export type UnsupervisedMethod = 'kmeans' | 'dbscan' | 'agglomerative' | 'gmm' | 'pca' | 'tsne' | 'isolation_forest' | 'lof';
export interface UnsupervisedInput { table: ColumnarTable; features: string[]; method: UnsupervisedMethod; params: Record<string, number | string>; seed: number }
export interface UnsupervisedOutput {
  method: UnsupervisedMethod;
  labels?: number[];
  nClusters?: number;
  noise?: number;
  silhouette?: number;
  inertia?: number;
  bic?: number;
  components?: number[][];
  explainedVariance?: number[];
  anomaly?: number[];
  scores?: number[];
  /** 2-D projection (row-major n × 2) for plotting */
  embedding: number[];
  featureNames: string[];
  durationMs: number;
}
export interface ForecastInput {
  table: ColumnarTable;
  timeColumn: string;
  valueColumn: string;
  method: 'arima' | 'ets';
  params: Record<string, number | string>;
  horizon: number;
  holdout: number;
}
export interface ForecastOutput {
  frequency: string;
  season: number;
  history: { t: string[]; y: number[] };
  holdout?: { pred: number[]; lo: number[]; hi: number[]; mae: number; rmse: number; mape: number };
  forecast: { pred: number[]; lo: number[]; hi: number[] };
  futureT: string[];
  aic: number;
  durationMs: number;
}

/** Map of task kinds → [input, output]. */
export interface TaskMap {
  parseCsv: [ParseCsvInput, ParseCsvOutput];
  train: [TrainInput, TrainOutput];
  sleep: [SleepInput, { completed: number }];
  benchmark: [BenchmarkInput, BenchmarkOutput];
  auto: [AutoInput, AutoOutput];
  predict: [PredictInput, PredictOutput];
  pyRun: [PyRunInput, PyRunOutput];
  trainGraph: [TrainGraphInput, TrainGraphOutput];
  unsupervised: [UnsupervisedInput, UnsupervisedOutput];
  forecast: [ForecastInput, ForecastOutput];
  exportPortable: [{ model: Uint8Array }, import('./tasks/exportPortable').PortableBundle];
  profile: [{ table: ColumnarTable; target?: string }, DataProfile];
  applyPipeline: [{ table: ColumnarTable; steps: PipelineStep[] }, { table: ColumnarTable; log: StepLog[] }];
}
export type TaskKindName = keyof TaskMap;
export type TaskSpec<K extends TaskKindName = TaskKindName> = { kind: K; input: TaskMap[K][0] };
