import type { PyHandle } from '../../engines/adapters';
import { defaultParams } from '../../models/params';
import { getPlugin } from '../../models/registry';
import { Rng } from '../../rng';
import type { BenchmarkInput, BenchmarkOutput, TaskContext } from '../types';

/**
 * M0 / performance-regression benchmark: synthetic data generated inside the worker
 * (no transfer cost), then a timed fit + predict of one plugin.
 */
export async function benchmarkTask(input: BenchmarkInput, ctx: TaskContext): Promise<BenchmarkOutput> {
  const plugin = getPlugin(input.pluginId);
  const rng = new Rng(input.seed ?? 1);
  const { rows, cols } = input;
  const k = input.task === 'regression' ? 0 : input.task === 'binary' ? 2 : 3;
  const X = new Float64Array(rows * cols);
  const y = new Float64Array(rows);
  const w = Float64Array.from({ length: cols }, () => rng.normal());
  for (let i = 0; i < rows; i++) {
    let s = 0;
    for (let j = 0; j < cols; j++) {
      const v = rng.normal();
      X[i * cols + j] = v;
      s += v * w[j] + (j < 3 ? 0.5 * v * v : 0);
    }
    s += rng.normal(0, 0.5);
    y[i] = k === 0 ? s : k === 2 ? (s > 0 ? 1 : 0) : s < -1 ? 0 : s < 1 ? 1 : 2;
  }
  if (input.tfBackend) {
    const tf = ctx.engine<typeof import('@tensorflow/tfjs')>('tfjs');
    if (!(await tf.setBackend(input.tfBackend))) throw new Error(`tf backend ${input.tfBackend} unavailable`);
    await tf.ready();
  }
  const params = { ...defaultParams(plugin, input.task), ...(input.params ?? {}) };
  const model = plugin.create({ task: input.task, nFeatures: cols, nClasses: k, params, rng: rng.fork('init'), engine: ctx.engine });
  const t0 = performance.now();
  await model.fit({ X: { rows, cols, data: X } , y }, { rng: rng.fork('fit'), engine: ctx.engine, checkpoint: ctx.checkpoint, progress: (p) => ctx.progress({ fraction: p.fraction }) });
  const fitMs = performance.now() - t0;
  const t1 = performance.now();
  if (k) model.predictProba!({ rows, cols, data: X }); else model.predict({ rows, cols, data: X });
  const predictMs = performance.now() - t1;
  model.dispose?.();
  let wasmHeapMB: number | undefined;
  try {
    const h = ctx.engine<PyHandle & { py: { _module?: { HEAP8: Int8Array } } }>('pyodide');
    wasmHeapMB = h.py._module ? h.py._module.HEAP8.length / 2 ** 20 : undefined;
  } catch { /* no pyodide in this worker */ }
  return { pluginId: input.pluginId, rows, cols, task: input.task, fitMs, predictMs, wasmHeapMB, tfBackend: input.tfBackend };
}
