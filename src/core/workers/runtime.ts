import { transfer } from 'comlink';
import { ENGINE_ADAPTERS } from '../engines/adapters';
import { tableTransferables } from '../data/table';
import { CancelledError, type EngineName } from '../models/types';
import { TASK_HANDLERS } from './tasks';
import type { TaskContext, TaskKindName, TaskMap, TaskProgress, TaskSpec } from './types';

declare function importScripts(...urls: string[]): void;

export interface EnginePayload {
  bootstrap: string[];
  files: Record<string, Uint8Array>;
  meta?: Record<string, unknown>;
}

const PROGRESS_INTERVAL_MS = 80;
const YIELD_INTERVAL_MS = 25;

/** Worker-side API exposed via Comlink. Also usable in-process (tests) when importScripts is absent. */
export function createWorkerApi(scope: typeof globalThis = globalThis) {
  const cancelled = new Set<string>();
  const engines = new Map<EngineName, unknown>();
  /** All files of all loaded engines (virtual file system for runtimes that fetch their assets). */
  const vfs = new Map<string, Uint8Array>();

  const engine = <T,>(name: EngineName): T => {
    if (!engines.has(name)) throw new Error(`Engine "${name}" not loaded in this worker`);
    return engines.get(name) as T;
  };

  return {
    ping: () => 'pong' as const,

    loadedEngines: () => [...engines.keys()],

    async loadEngine(name: EngineName, payload: EnginePayload): Promise<void> {
      if (engines.has(name)) return;
      const adapter = ENGINE_ADAPTERS[name];
      for (const [k, v] of Object.entries(payload.files)) vfs.set(k, v);
      adapter?.prepare?.(scope as never);
      for (const file of payload.bootstrap) {
        const url = URL.createObjectURL(new Blob([payload.files[file] as BlobPart], { type: 'text/javascript' }));
        try { importScripts(url); } finally { URL.revokeObjectURL(url); }
      }
      engines.set(name, adapter ? await adapter.init(scope as never, { files: payload.files, meta: payload.meta ?? {}, vfs, engine }) : true);
    },

    /** Test hook: register an already-available engine object (e.g. tfjs imported in Node). */
    provideEngine(name: EngineName, handle: unknown) {
      engines.set(name, handle);
    },

    cancel(taskId: string) {
      cancelled.add(taskId);
    },

    async run<K extends TaskKindName>(taskId: string, spec: TaskSpec<K>, onProgress?: (p: TaskProgress) => void): Promise<TaskMap[K][1]> {
      let lastProgress = 0, lastYield = performance.now();
      const ctx: TaskContext = {
        progress(p) {
          const now = performance.now();
          if (p.point || p.fraction === 1 || now - lastProgress >= PROGRESS_INTERVAL_MS) {
            lastProgress = now;
            void onProgress?.(p);
          }
        },
        async checkpoint() {
          if (performance.now() - lastYield >= YIELD_INTERVAL_MS) {
            await new Promise((r) => setTimeout(r, 0));
            lastYield = performance.now();
          }
          if (cancelled.has(taskId)) throw new CancelledError();
        },
        isCancelled: () => cancelled.has(taskId),
        engine,
      };
      try {
        const handler = TASK_HANDLERS[spec.kind] as (i: TaskMap[K][0], c: TaskContext) => Promise<TaskMap[K][1]>;
        const result = await handler(spec.input, ctx);
        if (spec.kind === 'parseCsv' || spec.kind === 'applyPipeline') {
          const r = result as TaskMap['parseCsv'][1];
          return transfer(result, tableTransferables(r.table));
        }
        return result;
      } finally {
        cancelled.delete(taskId);
      }
    },
  };
}

export type WorkerApi = ReturnType<typeof createWorkerApi>;
