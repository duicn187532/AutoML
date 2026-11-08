import { proxy, releaseProxy, transfer, wrap, type Remote } from 'comlink';
import type { EngineLoader } from '../engines/loader';
import { CancelledError, type EngineName } from '../models/types';
import type { WorkerApi } from './runtime';
import type { TaskKindName, TaskMap, TaskProgress, TaskSpec } from './types';

export type TaskStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface TaskSnapshot {
  id: string;
  label: string;
  kind: TaskKindName;
  status: TaskStatus;
  fraction: number;
  message?: string;
  /** Engine being loaded before the task starts. */
  engineLoading?: { name: string; fraction: number };
  error?: string;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
}

export interface SubmitOptions {
  label: string;
  engines?: EngineName[];
  onProgress?: (p: TaskProgress) => void;
  /** Buffers to transfer (not copy) to the worker. */
  transfer?: Transferable[];
}

export interface TaskHandle<R> {
  id: string;
  result: Promise<R>;
  cancel(): void;
}

interface Slot {
  worker: Worker;
  api: Remote<WorkerApi>;
  engines: Set<string>;
  /** Engines this worker has been assigned to load (counts toward engine caps before loading finishes). */
  reserved: Set<string>;
  busy: boolean;
  dead: boolean;
}

interface Job {
  snap: TaskSnapshot;
  spec: TaskSpec;
  opts: SubmitOptions;
  resolve(v: unknown): void;
  reject(e: unknown): void;
  slot?: Slot;
  cancelRequested?: boolean;
  hardTimer?: ReturnType<typeof setTimeout>;
}

export interface PoolOptions {
  size: number;
  createWorker: () => Worker;
  engineLoader?: EngineLoader;
  /** After a cooperative cancel request, terminate the worker if the task has not stopped (ms). */
  hardCancelMs?: number;
  /** Max number of workers that may hold a heavy engine (e.g. { pyodide: 1 } — each copy costs 0.2–0.5 GB). */
  engineWorkerCap?: Record<string, number>;
}

let seq = 0;
const newId = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * Fixed-size worker pool (Comlink). Features: FIFO queue, per-task progress, engine provisioning,
 * cooperative cancel (task checkpoints) escalating to terminate() + respawn, crash recovery.
 */
export class WorkerPool {
  private slots: Slot[] = [];
  private queue: Job[] = [];
  private jobs = new Map<string, Job>();
  private listeners = new Set<(s: TaskSnapshot) => void>();

  constructor(private opts: PoolOptions) {}

  subscribe(fn: (s: TaskSnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  snapshots(): TaskSnapshot[] {
    return [...this.jobs.values()].map((j) => ({ ...j.snap }));
  }

  submit<K extends TaskKindName>(spec: TaskSpec<K>, opts: SubmitOptions): TaskHandle<TaskMap[K][1]> {
    const id = newId();
    let resolve!: (v: unknown) => void, reject!: (e: unknown) => void;
    const result = new Promise<TaskMap[K][1]>((res, rej) => { resolve = res as never; reject = rej; });
    const job: Job = { snap: { id, label: opts.label, kind: spec.kind, status: 'queued', fraction: 0, createdAt: Date.now() }, spec, opts, resolve, reject };
    this.jobs.set(id, job);
    this.queue.push(job);
    this.emit(job);
    queueMicrotask(() => this.pump());
    return { id, result, cancel: () => this.cancel(id) };
  }

  cancel(id: string): void {
    const job = this.jobs.get(id);
    if (!job || job.snap.status !== 'queued' && job.snap.status !== 'running') return;
    if (job.snap.status === 'queued') {
      this.queue = this.queue.filter((j) => j !== job);
      this.finish(job, 'cancelled', new CancelledError());
      return;
    }
    if (job.cancelRequested) return;
    job.cancelRequested = true;
    job.snap.message = 'cancelling';
    this.emit(job);
    const slot = job.slot;
    if (!slot) return; // still provisioning engines; handled when it starts
    void slot.api.cancel(id).catch(() => undefined);
    job.hardTimer = setTimeout(() => {
      if (job.snap.status !== 'running') return;
      this.killSlot(slot);
      this.finish(job, 'cancelled', new CancelledError('Cancelled (worker terminated)'));
      this.pump();
    }, this.opts.hardCancelMs ?? 3000);
  }

  /** Remove finished tasks from the list. */
  clearFinished(): void {
    for (const [id, j] of this.jobs) if (j.snap.status !== 'queued' && j.snap.status !== 'running') this.jobs.delete(id);
  }

  terminateAll(): void {
    for (const s of this.slots) this.killSlot(s);
  }

  private emit(job: Job) {
    const s = { ...job.snap };
    for (const l of this.listeners) l(s);
  }

  private spawn(): Slot {
    const worker = this.opts.createWorker();
    const slot: Slot = { worker, api: wrap<WorkerApi>(worker), engines: new Set(), reserved: new Set(), busy: false, dead: false };
    worker.addEventListener('error', (e) => {
      e.preventDefault?.();
      const job = [...this.jobs.values()].find((j) => j.slot === slot && j.snap.status === 'running');
      this.killSlot(slot);
      if (job) this.finish(job, 'failed', new Error(`Worker crashed: ${e.message ?? 'unknown error'}`));
      this.pump();
    });
    this.slots.push(slot);
    return slot;
  }

  private killSlot(slot: Slot) {
    if (slot.dead) return;
    slot.dead = true;
    try { slot.api[releaseProxy](); } catch { /* ignore */ }
    slot.worker.terminate();
    this.slots = this.slots.filter((s) => s !== slot);
  }

  /**
   * Pick a worker for a job: prefer an idle worker that already has the job's engines loaded;
   * respect per-engine worker caps (heavy runtimes are not duplicated across workers).
   */
  private slotFor(job: Job): Slot | undefined | null {
    const need = job.opts.engines ?? [];
    const has = (s: Slot, e: string) => s.engines.has(e) || s.reserved.has(e);
    const idle = this.slots.filter((s) => !s.busy && !s.dead);
    const warm = idle.filter((s) => need.every((e) => has(s, e)));
    if (warm.length) return warm[0];
    const capped = need.filter((e) => this.opts.engineWorkerCap?.[e] !== undefined);
    // a worker that already holds the capped (heavy) engines can load whatever else is missing
    const holder = capped.length ? idle.find((s) => capped.every((e) => has(s, e))) : undefined;
    if (holder) return holder;
    const atCap = (e: string) => this.slots.filter((s) => !s.dead && has(s, e)).length >= this.opts.engineWorkerCap![e];
    // a capped engine already at its cap → must wait for the worker that has it
    if (capped.some((e) => atCap(e))) return null;
    const blank = idle.find((s) => !capped.length || !s.engines.size) ?? idle[0];
    if (blank) return blank;
    if (this.slots.length < this.opts.size) return this.spawn();
    return undefined;
  }

  private pump() {
    for (let i = 0; i < this.queue.length; ) {
      const job = this.queue[i];
      const slot = this.slotFor(job);
      if (slot === undefined) return; // no capacity at all
      if (slot === null) { i++; continue; } // this job must wait; try the next one
      this.queue.splice(i, 1);
      slot.busy = true;
      for (const e of job.opts.engines ?? []) slot.reserved.add(e);
      void this.start(job, slot);
    }
  }

  private async start(job: Job, slot: Slot) {
    job.snap.status = 'running';
    job.snap.startedAt = Date.now();
    this.emit(job);
    try {
      for (const name of job.opts.engines ?? []) await this.ensureEngine(slot, name, job);
      if (job.cancelRequested) throw new CancelledError();
      job.slot = slot;
      const onProgress = proxy((p: TaskProgress) => {
        if (job.snap.status !== 'running') return;
        if (p.fraction !== undefined) job.snap.fraction = p.fraction;
        if (p.message !== undefined && !job.cancelRequested) job.snap.message = p.message;
        job.opts.onProgress?.(p);
        this.emit(job);
      });
      const payload = job.opts.transfer?.length ? transfer(job.spec, job.opts.transfer) : job.spec;
      const result = await slot.api.run(job.snap.id, payload, onProgress);
      this.finish(job, 'done', undefined, result);
    } catch (err) {
      const cancelled = (err as Error)?.name === 'CancelledError' || job.cancelRequested;
      this.finish(job, cancelled ? 'cancelled' : 'failed', cancelled ? new CancelledError() : err);
    } finally {
      slot.busy = false;
      this.pump();
    }
  }

  /** Load an engine (and, first, the engines it depends on) into a worker slot. */
  private async ensureEngine(slot: Slot, name: string, job: Job, depth = 0): Promise<void> {
    if (slot.engines.has(name)) return;
    if (depth > 8) throw new Error(`Engine dependency cycle at ${name}`);
    if (!this.opts.engineLoader) throw new Error('No engine loader configured');
    const engine = await this.opts.engineLoader.load(name, (l, t) => {
      job.snap.engineLoading = { name, fraction: t ? l / t : 1 };
      this.emit(job);
    });
    for (const dep of engine.manifest.deps ?? []) await this.ensureEngine(slot, dep, job, depth + 1);
    job.snap.engineLoading = { name, fraction: 1 };
    job.snap.message = `init ${name}`;
    this.emit(job);
    await slot.api.loadEngine(name as EngineName, { bootstrap: engine.manifest.bootstrap, files: engine.files, meta: engine.manifest.meta });
    slot.engines.add(name);
    job.snap.engineLoading = undefined;
    job.snap.message = undefined;
  }

  private finish(job: Job, status: TaskStatus, error?: unknown, result?: unknown) {
    if (job.snap.status !== 'queued' && job.snap.status !== 'running') return; // already settled (e.g. hard cancel)
    if (job.hardTimer) clearTimeout(job.hardTimer);
    job.snap.status = status;
    job.snap.endedAt = Date.now();
    job.snap.engineLoading = undefined;
    if (status === 'done') job.snap.fraction = 1;
    if (error && status === 'failed') job.snap.error = (error as Error)?.message ?? String(error);
    if (status === 'cancelled') job.snap.message = undefined;
    this.emit(job);
    if (status === 'done') job.resolve(result);
    else job.reject(error);
  }
}
