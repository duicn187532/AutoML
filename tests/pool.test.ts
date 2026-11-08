import { describe, expect, it } from 'vitest';
import { expose } from 'comlink';
import { createWorkerApi } from '@/core/workers/runtime';
import { WorkerPool, type TaskSnapshot } from '@/core/workers/pool';

/** In-process stand-in for a Worker: Comlink over a MessageChannel. */
class FakeWorker extends EventTarget {
  private ch = new MessageChannel();
  terminated = false;
  constructor() {
    super();
    expose(createWorkerApi(), this.ch.port2 as never);
    this.ch.port1.addEventListener('message', (e) => this.dispatchEvent(new MessageEvent('message', { data: (e as MessageEvent).data })));
    this.ch.port1.start();
  }
  postMessage(msg: unknown, transfer?: Transferable[]) {
    this.ch.port1.postMessage(msg, transfer ?? []);
  }
  terminate() {
    this.terminated = true;
    this.ch.port1.close();
  }
}

const mkPool = (size = 1) => {
  const workers: FakeWorker[] = [];
  const pool = new WorkerPool({ size, createWorker: () => { const w = new FakeWorker(); workers.push(w); return w as unknown as Worker; }, hardCancelMs: 200 });
  return { pool, workers };
};

describe('WorkerPool', () => {
  it('runs tasks, reports progress and respects pool size', async () => {
    const { pool, workers } = mkPool(2);
    const seen: TaskSnapshot[] = [];
    pool.subscribe((s) => seen.push(s));
    const hs = [1, 2, 3].map(() => pool.submit({ kind: 'sleep', input: { steps: 3, stepMs: 5 } }, { label: 'sleep' }));
    const results = await Promise.all(hs.map((h) => h.result));
    expect(results).toEqual([{ completed: 3 }, { completed: 3 }, { completed: 3 }]);
    expect(workers.length).toBe(2);
    expect(seen.some((s) => s.status === 'queued')).toBe(true);
    expect(seen.filter((s) => s.status === 'done').length).toBe(3);
    pool.terminateAll();
  });

  it('cancels queued and running tasks cooperatively', async () => {
    const { pool } = mkPool(1);
    const a = pool.submit({ kind: 'sleep', input: { steps: 50, stepMs: 10 } }, { label: 'a' });
    const b = pool.submit({ kind: 'sleep', input: { steps: 1, stepMs: 1 } }, { label: 'b' });
    b.cancel();
    await expect(b.result).rejects.toThrow(/Cancelled/);
    await new Promise((r) => setTimeout(r, 40));
    a.cancel();
    await expect(a.result).rejects.toMatchObject({ name: 'CancelledError' });
    const snap = pool.snapshots().find((s) => s.id === a.id)!;
    expect(snap.status).toBe('cancelled');
    // pool is still usable afterwards
    await expect(pool.submit({ kind: 'sleep', input: { steps: 1, stepMs: 1 } }, { label: 'c' }).result).resolves.toEqual({ completed: 1 });
    pool.terminateAll();
  });

  it('surfaces task errors as failed', async () => {
    const { pool } = mkPool(1);
    const h = pool.submit({ kind: 'parseCsv', input: { bytes: new ArrayBuffer(0), fileName: 'empty.csv' } }, { label: 'bad' });
    await expect(h.result).rejects.toThrow(/empty/);
    expect(pool.snapshots()[0].status).toBe('failed');
    pool.terminateAll();
  });
});
