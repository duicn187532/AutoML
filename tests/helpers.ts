import { readFileSync } from 'node:fs';
import { parseCsv } from '@/core/data/parse';
import { DEFAULT_PREPROCESS } from '@/core/ml/preprocess';
import type { EngineName } from '@/core/models/types';
import type { TaskContext, TrainConfig } from '@/core/workers/types';

export function loadSample(name: string) {
  return parseCsv(readFileSync(`samples/${name}`, 'utf8')).table;
}

export function testCtx(engines: Partial<Record<EngineName, unknown>> = {}, onPoint?: (p: Record<string, number>) => void): TaskContext {
  let cancelled = false;
  return {
    progress: (p) => { if (p.point) onPoint?.(p.point); },
    checkpoint: async () => { if (cancelled) { const e = new Error('Cancelled'); e.name = 'CancelledError'; throw e; } },
    isCancelled: () => cancelled,
    engine: <T,>(n: EngineName) => { if (!(n in engines)) throw new Error(`no engine ${n}`); return engines[n] as T; },
    cancel: () => { cancelled = true; },
  } as TaskContext & { cancel(): void };
}

export function config(over: Partial<TrainConfig>): TrainConfig {
  return {
    datasetId: 'd', target: '', features: [], pluginId: 'logistic', params: {}, seed: 1, validFraction: 0.25,
    preprocess: DEFAULT_PREPROCESS, ...over,
  };
}
