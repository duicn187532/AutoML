import { useEffect, useRef, useState } from 'react';
import { importCsvFile } from '@/app/actions';
import { fmtBytes, fmtNum } from '@/app/format';
import { useProject } from '@/app/stores/project';
import { useUi } from '@/app/stores/ui';
import { cellString, type ColumnProfile, type ColumnarTable } from '@/core/data/table';
import { useT, type MessageKey } from '@/i18n';
import { SAMPLES } from './samples';

const PREVIEW_ROWS = 50;

function summary(c: ColumnProfile): string {
  if (c.kind === 'numeric') return `${fmtNum(c.min)} … ${fmtNum(c.max)} · μ ${fmtNum(c.mean)} · σ ${fmtNum(c.std)}`;
  return (c.top ?? []).slice(0, 4).map((x) => `${x.value} (${x.count})`).join(', ');
}

function ImportBar() {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<{ id: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const d = await fn();
      useUi.getState().selectDataset(d.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card import-bar">
      <button className="primary" disabled={busy} onClick={() => inputRef.current?.click()}>
        {t('data.import')}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.txt,text/csv"
        hidden
        data-testid="csv-input"
        onChange={async (e) => {
          const f = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (f) await run(async () => importCsvFile(f.name, await f.arrayBuffer()));
        }}
      />
      <span className="muted small">{t('data.importHint')}</span>
      <div className="spacer" />
      <span className="small muted">{t('data.loadSample')}:</span>
      {SAMPLES.map((s) => (
        <button key={s.id} disabled={busy} data-testid={`sample-${s.id}`} onClick={() => run(() => importCsvFile(s.fileName, new TextEncoder().encode(s.csv).buffer as ArrayBuffer, 'sample'))}>
          {t.text(s.label)}
        </button>
      ))}
      {error && <div className="error-text small full">{error}</div>}
    </div>
  );
}

export function DataModule() {
  const t = useT();
  const datasetId = useUi((s) => s.datasetId);
  const project = useProject((s) => s.project);
  const { getTable, removeDataset } = useProject();
  const dataset = project?.datasets.find((d) => d.id === datasetId);
  const [loaded, setLoaded] = useState<{ id: string; table: ColumnarTable } | null>(null);
  const table = loaded && loaded.id === dataset?.id ? loaded.table : null;

  useEffect(() => {
    let alive = true;
    if (dataset) getTable(dataset.id).then((tb) => alive && setLoaded({ id: dataset.id, table: tb })).catch(console.error);
    return () => { alive = false; };
  }, [dataset, getTable]);

  return (
    <div className="module">
      <h1>{t('nav.data')}</h1>
      <ImportBar />
      {!dataset ? (
        <p className="muted">{project?.datasets.length ? t('data.select') : t('panel.data.empty')}</p>
      ) : (
        <>
          <div className="card">
            <div className="row">
              <h2>{dataset.name}</h2>
              <span className="muted">
                {t('data.rows', { n: dataset.rowCount.toLocaleString() })} · {t('data.cols', { n: dataset.columns.length })}
                {dataset.source.bytes ? ` · ${fmtBytes(dataset.source.bytes)}` : ''} · v{dataset.hash.slice(0, 8)}
              </span>
              <div className="spacer" />
              <button className="danger" onClick={() => { removeDataset(dataset.id); useUi.getState().selectDataset(null); }}>
                {t('data.delete')}
              </button>
            </div>
            {dataset.warnings?.length ? (
              <details className="warn">
                <summary>{t('data.warnings')} ({dataset.warnings.length})</summary>
                <ul>{dataset.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </details>
            ) : null}
          </div>
          <div className="card">
            <h3>{t('data.columns')}</h3>
            <div className="table-wrap">
              <table className="grid" data-testid="columns-table">
                <thead>
                  <tr>
                    <th>{t('data.col.name')}</th>
                    <th>{t('data.col.kind')}</th>
                    <th className="num">{t('data.col.missing')}</th>
                    <th className="num">{t('data.col.unique')}</th>
                    <th>{t('data.col.summary')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dataset.columns.map((c) => (
                    <tr key={c.name}>
                      <td>{c.name}</td>
                      <td><span className={`kind kind-${c.kind}`}>{t(`kind.${c.kind}` as MessageKey)}</span></td>
                      <td className="num">{c.missing ? `${c.missing} (${((c.missing / dataset.rowCount) * 100).toFixed(1)}%)` : 0}</td>
                      <td className="num">{c.unique.toLocaleString()}</td>
                      <td className="small muted ellipsis">{summary(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <h3>{t('data.preview', { n: Math.min(PREVIEW_ROWS, dataset.rowCount) })}</h3>
            {table && (
              <div className="table-wrap">
                <table className="grid compact">
                  <thead>
                    <tr>
                      <th>#</th>
                      {table.columns.map((c) => <th key={c.name}>{c.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.min(PREVIEW_ROWS, table.rowCount) }, (_, i) => (
                      <tr key={i}>
                        <td className="muted">{i + 1}</td>
                        {table.columns.map((c) => {
                          const v = cellString(c, i);
                          return <td key={c.name} className={v === null ? 'na' : c.kind === 'numeric' ? 'num' : undefined}>{v ?? 'NA'}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
