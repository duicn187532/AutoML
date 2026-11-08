import { EngineLoader } from '@/core/engines/loader';
import { ProjectStorage } from '@/core/storage/db';
import { WorkerPool } from '@/core/workers/pool';
import MlWorker from '@/core/workers/ml.worker.ts?worker&inline';

/** App-wide singletons (browser only). */
export const storage = new ProjectStorage();
export const engineLoader = new EngineLoader('./');

const cores = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
export const pool = new WorkerPool({
  size: cores,
  // Inline worker → Blob URL; the only worker type that works under file:// (verified in M0).
  createWorker: () => new MlWorker(),
  engineLoader,
  hardCancelMs: 3000,
  // M0: Pyodide + sklearn stack ≈ 130–460 MB WASM heap per worker → keep a single Python worker.
  engineWorkerCap: { pyodide: 1 },
});

export const APP_VERSION: string = __APP_VERSION__;
export const ENGINE_VERSIONS: Record<string, string> = __ENGINE_VERSIONS__;
