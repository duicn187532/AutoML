import { useRef, useState } from 'react';
import { runScriptCell } from '@/app/actions';
import { fmtDuration } from '@/app/format';
import { useProject } from '@/app/stores/project';
import type { ScriptRecord } from '@/core/project/types';
import { newId } from '@/core/util/id';
import type { PyRunOutput } from '@/core/workers/types';
import { useT } from '@/i18n';
import { PageHeader } from '@/app/ui/Page';

const STARTER = (dataset?: string) => [
  `# ${dataset ? '' : 'Import a dataset first. '}Workbench API: aml.datasets(), aml.load(name), aml.save_dataset(df, name)\nimport pandas as pd\nimport numpy as np${dataset ? `\ndf = aml.load(${JSON.stringify(dataset)})\ndf.describe()` : ''}`,
  'import matplotlib.pyplot as plt\n' + (dataset ? 'df.hist(figsize=(9, 6))\nplt.tight_layout()' : 'plt.plot(np.sin(np.linspace(0, 6, 100)))'),
];

function Cell({ source, output, running, onChange, onRun, onDelete, onAddBelow }: {
  source: string; output?: PyRunOutput | { error: string }; running: boolean;
  onChange: (s: string) => void; onRun: () => void; onDelete: () => void; onAddBelow: () => void;
}) {
  const t = useT();
  const ref = useRef<HTMLTextAreaElement>(null);
  const rows = Math.min(30, Math.max(3, source.split('\n').length + 1));
  return (
    <div className="cell">
      <div className="cell-head">
        <button className="primary" disabled={running} onClick={onRun} title="Shift+Enter">{running ? '…' : '▶'}</button>
        <span className="spacer" />
        <button className="link" onClick={onAddBelow}>+ {t('script.addCell')}</button>
        <button className="link danger" onClick={onDelete}>{t('exp.delete')}</button>
      </div>
      <textarea
        ref={ref}
        className="code"
        spellCheck={false}
        rows={rows}
        value={source}
        onChange={(e) => onChange(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); onRun(); }
          if (e.key === 'Tab') {
            e.preventDefault();
            const el = e.currentTarget, a = el.selectionStart, b = el.selectionEnd;
            onChange(el.value.slice(0, a) + '    ' + el.value.slice(b));
            requestAnimationFrame(() => { if (ref.current) ref.current.selectionStart = ref.current.selectionEnd = a + 4; });
          }
        }}
      />
      {output && (
        <div className="cell-out">
          {'stdout' in output && output.stdout && <pre>{output.stdout}</pre>}
          {'stderr' in output && output.stderr && <pre className="muted">{output.stderr}</pre>}
          {'result' in output && output.result && <pre className="result">{output.result}</pre>}
          {'images' in output && output.images.map((b64, i) => <img key={i} alt={`figure ${i + 1}`} src={`data:image/png;base64,${b64}`} />)}
          {'saved' in output && output.saved.map((s) => <div key={s.name} className="small ok">✓ {t('script.saved', { name: s.name, n: s.table.rowCount })}</div>)}
          {output.error && <pre className="error-text">{output.error}</pre>}
          {'durationMs' in output && <div className="small muted">{fmtDuration(output.durationMs)}</div>}
        </div>
      )}
    </div>
  );
}

export function ScriptModule() {
  const t = useT();
  const project = useProject((s) => s.project)!;
  const upsertScript = useProject((s) => s.upsertScript);
  const [created] = useState<ScriptRecord>(() => ({ id: newId('s'), name: 'Script 1', cells: STARTER(project.datasets[0]?.name).map((source) => ({ id: newId('c'), source })), updatedAt: 0 }));
  const script = project.scripts[0] ?? created;
  const [outputs, setOutputs] = useState<Record<string, PyRunOutput | { error: string }>>({});
  const [running, setRunning] = useState<string | null>(null);
  const save = (cells: ScriptRecord['cells']) => upsertScript({ ...script, cells, updatedAt: Date.now() });

  const run = async (id: string, reset = false) => {
    const cell = script.cells.find((c) => c.id === id);
    if (!cell) return;
    if (!project.scripts.length) save(script.cells);
    setRunning(id);
    try {
      const out = await runScriptCell(script.id, cell.source, reset);
      setOutputs((o) => ({ ...o, [id]: out }));
    } catch (e) {
      setOutputs((o) => ({ ...o, [id]: { error: (e as Error).message } }));
    } finally {
      setRunning(null);
    }
  };
  const runAll = async () => { for (const [i, c] of script.cells.entries()) await run(c.id, i === 0); };
  const insertAt = (i: number) => { const cells = [...script.cells]; cells.splice(i, 0, { id: newId('c'), source: '' }); save(cells); };

  return (
    <div className="module">
      <PageHeader id="script" />
      <div className="card">
        <div className="row">
          <button className="primary" disabled={!!running} onClick={runAll} data-testid="script-run-all">{t('script.runAll')}</button>
          <button disabled={!!running} onClick={() => { setOutputs({}); void runScriptCell(script.id, 'None', true); }}>{t('script.restart')}</button>
          <span className="spacer" />
          <span className="small muted">{t('script.datasets')}: {project.datasets.map((d) => d.name).join(', ') || '—'}</span>
        </div>
        <p className="small muted">{t('script.hint')}</p>
      </div>
      {script.cells.map((c, i) => (
        <Cell
          key={c.id}
          source={c.source}
          output={outputs[c.id]}
          running={running === c.id}
          onChange={(src) => save(script.cells.map((x) => (x.id === c.id ? { ...x, source: src } : x)))}
          onRun={() => run(c.id)}
          onDelete={() => save(script.cells.filter((x) => x.id !== c.id))}
          onAddBelow={() => insertAt(i + 1)}
        />
      ))}
      <button onClick={() => insertAt(script.cells.length)}>+ {t('script.addCell')}</button>
    </div>
  );
}
