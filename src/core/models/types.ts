import type { I18nText } from '@/i18n/types';
import type { Matrix } from '../ml/matrix';
import type { TaskKind } from '../ml/preprocess';
import type { Rng } from '../rng';

/** Heavy runtimes loaded on demand as engine packs. Plugins with `engines: []` are pure TS. */
export type EngineName = 'tfjs' | 'pyodide' | 'py-sklearn' | 'py-gbdt' | 'py-stats' | 'py-plot' | 'xlsx' | 'duckdb' | 'transformers';

export type ModelFamily = 'linear' | 'tree' | 'ensemble' | 'kernel' | 'neighbors' | 'bayes' | 'neural' | 'cluster' | 'other';

interface ParamBase {
  key: string;
  label: I18nText;
  help?: I18nText;
}
export type NumberParam = ParamBase & {
  type: 'int' | 'float';
  default: number;
  min: number;
  max: number;
  step?: number;
  /** Search / slider on log scale (learning rates, regularisation). */
  log?: boolean;
  recommended?: [number, number];
};
export type EnumParam = ParamBase & { type: 'enum'; default: string; options: { value: string; label: I18nText }[] };
export type BoolParam = ParamBase & { type: 'bool'; default: boolean };
export type ParamSpec = NumberParam | EnumParam | BoolParam;
export type ParamValues = Record<string, number | string | boolean>;

/** Serializable trained model. Binary parts (weights) live in `binary`. */
export interface ModelArtifact {
  pluginId: string;
  pluginVersion: number;
  task: TaskKind;
  nFeatures: number;
  nClasses: number;
  params: ParamValues;
  payload: unknown;
  binary?: Record<string, Uint8Array>;
}

export interface FitData {
  X: Matrix;
  /** Class index (classification) or standardised target (regression). */
  y: Float64Array;
  valid?: { X: Matrix; y: Float64Array };
}

export interface FitProgress {
  /** 0..1 */
  fraction: number;
  /** One point of the learning curve, e.g. { epoch: 3, loss: 0.4, val_loss: 0.5 }. */
  point?: Record<string, number>;
  message?: string;
}

export interface FitContext {
  rng: Rng;
  progress(p: FitProgress): void;
  /** Yield to the worker event loop; throws CancelledError when the task was cancelled. */
  checkpoint(): Promise<void>;
  /** Access a loaded engine global (e.g. tf). Only engines declared in plugin.engines are available. */
  engine<T = unknown>(name: EngineName): T;
}

export interface FitReport {
  history: Record<string, number[]>;
  bestEpoch?: number;
  epochs?: number;
  notes?: string[];
}

export interface ModelInit {
  task: TaskKind;
  nFeatures: number;
  nClasses: number;
  params: ParamValues;
  rng: Rng;
  engine<T = unknown>(name: EngineName): T;
}

export interface TrainedModel {
  fit(data: FitData, ctx: FitContext): Promise<FitReport>;
  /** Regression: predictions in the (standardised) training target space. */
  predict(X: Matrix): Float64Array;
  /** Classification: row-wise class probabilities (rows × nClasses). Always provided for classifiers. */
  predictProba?(X: Matrix): Matrix;
  export(): Promise<ModelArtifact>;
  dispose?(): void;
}

export interface ModelPlugin {
  id: string;
  /** Bump when the artifact payload format changes. */
  version: number;
  name: I18nText;
  description: I18nText;
  family: ModelFamily;
  tasks: TaskKind[];
  engines: EngineName[];
  params: ParamSpec[];
  /** Task-specific default overrides. */
  taskDefaults?: Partial<Record<TaskKind, ParamValues>>;
  create(init: ModelInit): TrainedModel;
  load(artifact: ModelArtifact, init: Omit<ModelInit, 'params' | 'rng'>): Promise<TrainedModel>;
}

export class CancelledError extends Error {
  constructor(message = 'Cancelled') {
    super(message);
    this.name = 'CancelledError';
  }
}
