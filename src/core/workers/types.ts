import type { ColumnarTable } from '../data/table';
import type { MetricSet } from '../ml/metrics';
import type { PreprocessConfig, PreprocessorState, TargetState, TaskKind } from '../ml/preprocess';
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
}
export interface ParseCsvOutput {
  table: ColumnarTable;
  warnings: string[];
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
  validFraction: number;
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
  metrics: { train: MetricSet; valid: MetricSet };
  confusion?: number[][];
  roc?: { fpr: number[]; tpr: number[] };
  history: Record<string, number[]>;
  bestEpoch?: number;
  notes: string[];
  artifact: ModelArtifact;
  nTrain: number;
  nValid: number;
  durationMs: number;
}

export interface SleepInput {
  steps: number;
  stepMs: number;
  /** Simulate a non-cooperative task that never yields (tests hard cancel). */
  blocking?: boolean;
}

/** Map of task kinds → [input, output]. */
export interface TaskMap {
  parseCsv: [ParseCsvInput, ParseCsvOutput];
  train: [TrainInput, TrainOutput];
  sleep: [SleepInput, { completed: number }];
}
export type TaskKindName = keyof TaskMap;
export type TaskSpec<K extends TaskKindName = TaskKindName> = { kind: K; input: TaskMap[K][0] };
