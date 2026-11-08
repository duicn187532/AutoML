import { logisticPlugin } from './builtin/logistic';
import { mlpPlugin } from './builtin/mlp';
import { ridgePlugin } from './builtin/ridge';
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

for (const p of [logisticPlugin, ridgePlugin, mlpPlugin]) registerPlugin(p);
