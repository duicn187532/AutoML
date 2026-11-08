import type { SleepInput, TaskContext } from '../types';

/** Diagnostic task used by tests and the pool self-check. */
export async function sleepTask(input: SleepInput, ctx: TaskContext): Promise<{ completed: number }> {
  let completed = 0;
  for (let i = 0; i < input.steps; i++) {
    if (input.blocking) {
      // busy wait that never yields; the counter keeps minifiers from deleting the loop
      const end = Date.now() + input.stepMs;
      let spins = 0;
      while (Date.now() < end) spins++;
      if (spins < 0) throw new Error('unreachable');
    } else {
      await new Promise((r) => setTimeout(r, input.stepMs));
      await ctx.checkpoint();
    }
    completed++;
    ctx.progress({ fraction: completed / input.steps });
  }
  return { completed };
}
