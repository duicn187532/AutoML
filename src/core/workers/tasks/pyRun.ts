import type { PyHandle } from '../../engines/adapters';
import scriptSource from '../../engines/py/aml_script.py?raw';
import { inferTable } from '../../data/infer';
import type { ColumnarTable } from '../../data/table';
import type { PyRunInput, PyRunOutput, TaskContext } from '../types';

interface ScriptModule {
  put_column(table: string, column: string, values: unknown, numeric: boolean): void;
  reset(session: string): void;
  run_cell(session: string, code: string): Promise<string>;
}

let mod: ScriptModule | null = null;

/** Run one script cell in the persistent Python namespace of its session. */
export async function pyRunTask(input: PyRunInput, ctx: TaskContext): Promise<PyRunOutput> {
  const h = ctx.engine<PyHandle>('pyodide');
  if (!mod) {
    h.py.FS.writeFile('/home/pyodide/aml_script.py', scriptSource);
    mod = h.py.pyimport('aml_script') as unknown as ScriptModule;
  }
  if (input.reset) mod.reset(input.session);
  for (const [name, t] of Object.entries(input.tables ?? {})) {
    for (const c of t.columns) mod.put_column(name, c.name, c.values, c.kind === 'numeric');
  }
  const t0 = performance.now();
  const raw = JSON.parse(await mod.run_cell(input.session, input.code)) as Omit<PyRunOutput, 'saved' | 'durationMs'> & {
    saved: { name: string; table: { rowCount: number; columns: { name: string; numeric: boolean; values: (number | string | null)[] }[] } }[];
  };
  // DataFrames saved with aml.save_dataset → typed tables
  const saved = raw.saved.map(({ name, table }) => {
    const t: ColumnarTable = inferTable(table.columns.map((c) => c.name), table.columns.map((c) => c.values.map((v) => (v === null ? null : String(v)))));
    return { name, table: t };
  });
  return { ...raw, saved, durationMs: performance.now() - t0 };
}
