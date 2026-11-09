import { useEffect, useMemo, useState } from 'react';
import { pool } from '@/app/services';
import { useProject } from '@/app/stores/project';
import { useUi } from '@/app/stores/ui';
import type { StepLog } from '@/core/data/ops';
import type { ColumnarTable } from '@/core/data/table';
import type { DatasetRecord, PipelineRecord, PipelineStep } from '@/core/project/types';
import { newId } from '@/core/util/id';
import { newPipeline } from '@/core/project/types';
import { useT, type MessageKey } from '@/i18n';

type Op = PipelineStep['op'];
type FieldType = 'column' | 'columns' | 'optColumn' | 'text' | 'number' | 'numbers' | 'enum' | 'bool' | 'multi';
interface Field { key: string; type: FieldType; options?: string[] }

/** Form definition per step type (labels come from i18n `step.field.<key>`). */
const STEP_FORMS: Record<Op, Field[]> = {
  dropColumns: [{ key: 'columns', type: 'columns' }],
  renameColumn: [{ key: 'from', type: 'column' }, { key: 'to', type: 'text' }],
  setKind: [{ key: 'column', type: 'column' }, { key: 'kind', type: 'enum', options: ['numeric', 'categorical', 'text', 'datetime', 'id'] }],
  dropMissingRows: [{ key: 'columns', type: 'columns' }],
  fillMissing: [{ key: 'column', type: 'column' }, { key: 'value', type: 'text' }],
  filterRows: [{ key: 'column', type: 'column' }, { key: 'cmp', type: 'enum', options: ['<', '<=', '>', '>=', '==', '!=', 'in', 'notin', 'isna', 'notna'] }, { key: 'value', type: 'text' }],
  dropDuplicates: [{ key: 'columns', type: 'columns' }],
  sampleRows: [{ key: 'n', type: 'number' }, { key: 'seed', type: 'number' }, { key: 'stratify', type: 'optColumn' }],
  dateExpand: [{ key: 'column', type: 'column' }, { key: 'parts', type: 'multi', options: ['year', 'month', 'day', 'dow', 'hour'] }, { key: 'drop', type: 'bool' }],
  mathTransform: [{ key: 'column', type: 'column' }, { key: 'fn', type: 'enum', options: ['log1p', 'sqrt', 'abs', 'square'] }, { key: 'output', type: 'text' }],
  interaction: [{ key: 'a', type: 'column' }, { key: 'fn', type: 'enum', options: ['*', '/', '+', '-'] }, { key: 'b', type: 'column' }, { key: 'output', type: 'text' }],
  lag: [{ key: 'column', type: 'column' }, { key: 'lags', type: 'numbers' }, { key: 'orderBy', type: 'optColumn' }, { key: 'groupBy', type: 'optColumn' }],
  rolling: [{ key: 'column', type: 'column' }, { key: 'window', type: 'number' }, { key: 'stat', type: 'enum', options: ['mean', 'std', 'min', 'max'] }, { key: 'orderBy', type: 'optColumn' }, { key: 'groupBy', type: 'optColumn' }],
};
const OPS = Object.keys(STEP_FORMS) as Op[];

function defaultStep(op: Op, cols: string[]): PipelineStep {
  const s: Record<string, unknown> = { op };
  let nthColumn = 0;
  for (const f of STEP_FORMS[op]) {
    s[f.key] = f.type === 'column' ? cols[Math.min(nthColumn++, cols.length - 1)] ?? '' : f.type === 'columns' ? [] : f.type === 'number' ? 3 : f.type === 'numbers' ? [1] : f.type === 'enum' ? f.options![0]
      : f.type === 'bool' ? false : f.type === 'multi' ? [...f.options!.slice(0, 4)] : f.type === 'optColumn' ? undefined : '';
  }
  if (op === 'sampleRows') Object.assign(s, { n: 3000, seed: 42 });
  return s as unknown as PipelineStep;
}

export function stepSummary(t: ReturnType<typeof useT>, s: PipelineStep): string {
  const parts = STEP_FORMS[s.op].map((f) => {
    const v = (s as unknown as Record<string, unknown>)[f.key];
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) return null;
    return `${t(`step.field.${f.key}` as MessageKey)}=${Array.isArray(v) ? v.join(',') : String(v)}`;
  });
  return `${t(`step.op.${s.op}` as MessageKey)} · ${parts.filter(Boolean).join(' · ')}`;
}

function StepForm({ step, columns, onChange }: { step: PipelineStep; columns: string[]; onChange: (s: PipelineStep) => void }) {
  const t = useT();
  const rec = step as unknown as Record<string, unknown>;
  const set = (k: string, v: unknown) => onChange({ ...rec, [k]: v } as unknown as PipelineStep);
  return (
    <div className="step-form">
      {STEP_FORMS[step.op].map((f) => {
        const v = rec[f.key];
        const label = t(`step.field.${f.key}` as MessageKey);
        let input;
        if (f.type === 'column' || f.type === 'optColumn')
          input = (
            <select value={(v as string) ?? ''} onChange={(e) => set(f.key, e.currentTarget.value || undefined)}>
              {f.type === 'optColumn' && <option value="">—</option>}
              {columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          );
        else if (f.type === 'columns' || f.type === 'multi') {
          const opts = f.type === 'columns' ? columns : f.options!;
          const sel = (v as string[]) ?? [];
          input = (
            <div className="checks inline">
              {opts.map((c) => (
                <label key={c} className="check">
                  <input type="checkbox" checked={sel.includes(c)} onChange={(e) => set(f.key, e.currentTarget.checked ? [...sel, c] : sel.filter((x) => x !== c))} />
                  {c}
                </label>
              ))}
            </div>
          );
        } else if (f.type === 'enum')
          input = <select value={String(v)} onChange={(e) => set(f.key, e.currentTarget.value)}>{f.options!.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
        else if (f.type === 'bool') input = <input type="checkbox" checked={!!v} onChange={(e) => set(f.key, e.currentTarget.checked)} />;
        else if (f.type === 'number') input = <input type="number" value={Number(v)} onChange={(e) => set(f.key, Number(e.currentTarget.value))} />;
        else if (f.type === 'numbers') input = <input value={((v as number[]) ?? []).join(',')} onChange={(e) => set(f.key, e.currentTarget.value.split(',').map((x) => parseInt(x, 10)).filter((x) => x > 0))} />;
        else input = <input value={(v as string) ?? ''} onChange={(e) => set(f.key, e.currentTarget.value)} />;
        return (
          <div className="field" key={f.key}>
            <label>{label}</label>
            {input}
          </div>
        );
      })}
    </div>
  );
}

/** Replayable cleaning steps for one dataset; "save" materialises them as a new derived dataset. */
export function Clean({ dataset, table }: { dataset: DatasetRecord; table: ColumnarTable }) {
  const t = useT();
  const project = useProject((s) => s.project)!;
  const { upsertPipeline, addDataset } = useProject();
  const pipeline = project.pipelines.filter((p) => p.inputDatasetId === dataset.id).at(-1);
  const steps = useMemo(() => pipeline?.steps ?? [], [pipeline]);
  const [newOp, setNewOp] = useState<Op>('dropColumns');
  const [draft, setDraft] = useState<PipelineStep | null>(null);
  const [result, setResult] = useState<{ key: string; log: StepLog[]; rows: number; cols: number; columns: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const key = JSON.stringify(steps);

  // live dry-run in a worker whenever the steps change
  useEffect(() => {
    let alive = true;
    const h = pool.submit({ kind: 'applyPipeline', input: { table, steps } }, { label: 'pipeline preview' });
    h.result.then((r) => alive && setResult({ key, log: r.log, rows: r.table.rowCount, cols: r.table.columns.length, columns: r.table.columns.map((c) => c.name) }), () => {});
    return () => { alive = false; };
  }, [table, steps, key]);

  const save = (next: PipelineStep[]) => {
    const rec: PipelineRecord = pipeline
      ? { ...pipeline, steps: next }
      : newPipeline(newId('pl'), dataset, next);
    upsertPipeline(rec);
    return rec;
  };
  const cur = result?.key === key ? result : null;
  // columns available to the next step = output columns of the current pipeline
  const columns = cur?.columns ?? dataset.columns.map((c) => c.name);

  const materialise = async () => {
    if (!pipeline) return;
    setSaving(true);
    try {
      const r = await pool.submit({ kind: 'applyPipeline', input: { table, steps } }, { label: `pipeline → ${dataset.name}` }).result;
      const failed = r.log.filter((l) => l.error);
      if (failed.length) throw new Error(failed.map((l) => `#${l.step + 1}: ${l.error}`).join('; '));
      const d = await addDataset(r.table, { name: `${dataset.name} (clean)`, source: { type: 'derived' }, derivedFrom: { datasetId: dataset.id, pipelineId: pipeline.id } });
      upsertPipeline({ ...pipeline, outputDatasetId: d.id });
      useUi.getState().selectDataset(d.id);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" data-testid="clean">
      <h3>{t('clean.title')}</h3>
      <p className="small muted">{t('clean.hint')}</p>
      <ol className="steps">
        {steps.map((s, i) => {
          const log = cur?.log[i];
          return (
            <li key={i} className={log?.error ? 'step error' : 'step'}>
              <span className="step-text">{stepSummary(t, s)}</span>
              {log && <span className="small muted">{log.error ? `⚠ ${log.error}` : t('clean.rowsAfter', { rows: log.rowsAfter.toLocaleString(), cols: log.colsAfter })}</span>}
              <span className="spacer" />
              <button className="link" disabled={i === 0} onClick={() => { const n = [...steps]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; save(n); }}>↑</button>
              <button className="link danger" onClick={() => save(steps.filter((_, k) => k !== i))}>{t('exp.delete')}</button>
            </li>
          );
        })}
      </ol>
      {steps.length === 0 && <p className="muted small">{t('clean.empty')}</p>}
      <div className="row">
        <select value={newOp} onChange={(e) => { const op = e.currentTarget.value as Op; setNewOp(op); setDraft(defaultStep(op, columns)); }} data-testid="step-op">
          {OPS.map((op) => <option key={op} value={op}>{t(`step.op.${op}` as MessageKey)}</option>)}
        </select>
        {!draft && <button onClick={() => setDraft(defaultStep(newOp, columns))}>{t('clean.add')}</button>}
      </div>
      {draft && (
        <div className="card inset">
          <StepForm step={draft} columns={columns} onChange={setDraft} />
          <div className="row">
            <button className="primary" data-testid="step-add" onClick={() => { save([...steps, draft]); setDraft(null); }}>{t('clean.add')}</button>
            <button onClick={() => setDraft(null)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
      <div className="row">
        <span className="muted small">{cur ? t('clean.result', { rows: cur.rows.toLocaleString(), cols: cur.cols }) : '…'}</span>
        <span className="spacer" />
        <button className="primary" disabled={!steps.length || saving} onClick={materialise} data-testid="clean-save">{t('clean.save')}</button>
      </div>
    </div>
  );
}
