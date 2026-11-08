import type { TaskKind } from '../ml/preprocess';
import type { ParamValues } from '../models/types';

/**
 * Quality presets. Each entry is a plugin + well-known strong defaults (portfolio idea from
 * AutoGluon / auto-sklearn: a few diverse, robust configurations beat blind search).
 * `search` = number of extra HPO trials (TPE + successive halving) for that plugin.
 */
export type Preset = 'fast' | 'balanced' | 'best';

export interface PortfolioEntry {
  pluginId: string;
  params: ParamValues;
  label: string;
  search?: number;
}

export function portfolio(preset: Preset, task: TaskKind, rows: number): PortfolioEntry[] {
  const cls = task !== 'regression';
  const big = rows > 50_000;
  const base: PortfolioEntry[] = [
    { pluginId: 'hist_gbdt', params: { maxIter: 300, learningRate: 0.08, maxLeafNodes: 31, earlyStopping: 20 }, label: 'HistGBDT' },
    { pluginId: cls ? 'logistic' : 'ridge', params: cls ? { epochs: 200, learningRate: 0.05, l2: 1e-4, patience: 10 } : { alpha: 1 }, label: cls ? 'Logistic' : 'Ridge' },
    { pluginId: 'random_forest', params: { nEstimators: big ? 100 : 300, maxFeatures: cls ? 'sqrt' : '1.0', minSamplesLeaf: 1, maxDepth: 0 }, label: 'RandomForest' },
  ];
  if (preset === 'fast') return base;
  const balanced: PortfolioEntry[] = [
    ...base,
    { pluginId: 'xgboost', params: { nEstimators: 1000, maxDepth: 6, learningRate: 0.05, subsample: 0.8, colsample: 0.8, lambda: 1, earlyStopping: 50 }, label: 'XGBoost' },
    { pluginId: 'extra_trees', params: { nEstimators: big ? 100 : 300, maxFeatures: cls ? 'sqrt' : '1.0', minSamplesLeaf: 1, maxDepth: 0 }, label: 'ExtraTrees' },
    { pluginId: 'mlp', params: { hiddenLayers: 2, units: 128, dropout: 0.1, learningRate: 0.003, epochs: 200, batchSize: 128, patience: 15, activation: 'relu', l2: 0, backend: 'cpu' }, label: 'MLP' },
  ];
  if (preset === 'balanced') return balanced;
  return [
    ...balanced,
    { pluginId: 'xgboost', params: { nEstimators: 2000, maxDepth: 4, learningRate: 0.02, subsample: 0.7, colsample: 0.6, lambda: 3, earlyStopping: 100 }, label: 'XGBoost-deep-slow', search: 12 },
    { pluginId: 'lightgbm', params: { nEstimators: 1000, numLeaves: 63, learningRate: 0.03, minChildSamples: 20, subsample: 0.8, colsample: 0.8, lambda: 1, earlyStopping: 50 }, label: 'LightGBM', search: 8 },
    ...(rows <= 10_000 ? [{ pluginId: 'knn', params: { k: 15, weights: 'distance' }, label: 'kNN' }] : []),
  ];
}
