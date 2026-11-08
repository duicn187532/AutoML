import { logisticPlugin } from './builtin/logistic';
import { mlpPlugin } from './builtin/mlp';
import { ridgePlugin } from './builtin/ridge';
import { SKLEARN_DEFS, sklearnPlugin } from './builtin/sklearn';
import type { ModelPlugin } from './types';
import type { TaskKind } from '../ml/preprocess';

/**
 * Model plugin registry. M3 adds Pyodide-backed sklearn / XGBoost / LightGBM plugins here;
 * each plugin only declares the engines it needs and they are loaded on demand.
 */
const plugins = new Map<string, ModelPlugin>();

export function registerPlugin(p: ModelPlugin): void {
  if (plugins.has(p.id)) throw new Error(`Duplicate model plugin id: ${p.id}`);
  plugins.set(p.id, p);
}

export function getPlugin(id: string): ModelPlugin {
  const p = plugins.get(id);
  if (!p) throw new Error(`Unknown model plugin: ${id}`);
  return p;
}

export function listPlugins(task?: TaskKind): ModelPlugin[] {
  return [...plugins.values()].filter((p) => !task || p.tasks.includes(task));
}

for (const p of [logisticPlugin, ridgePlugin, mlpPlugin, ...SKLEARN_DEFS.map(sklearnPlugin)]) registerPlugin(p);

/** Display name that also covers pseudo-plugins (Auto-mode ensembles). */
export function pluginName(id: string): ModelPlugin['name'] {
  if (id === 'auto') return { 'zh-TW': 'AutoML ensemble', en: 'AutoML ensemble' };
  return plugins.get(id)?.name ?? { 'zh-TW': id, en: id };
}
