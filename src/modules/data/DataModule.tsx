import { useRef, useState } from 'react';
import { importCsvFile, importImages } from '@/app/actions';
import { ImageLabeler } from './Images';
import { fmtBytes } from '@/app/format';
import { useProject } from '@/app/stores/project';
import { useUi } from '@/app/stores/ui';
import { cellString, type ColumnKind, type ColumnarTable } from '@/core/data/table';
import { newId } from '@/core/util/id';
import { newPipeline } from '@/core/project/types';
import { Clean } from './Clean';
import { Explore } from './Explore';
import { useProfile, useTable } from './hooks';
import { ColumnsTable, QualityReport } from './Overview';
import { useT, type MessageKey } from '@/i18n';
import { SAMPLES, SAMPLE_GROUPS, sampleBytes, type Sample } from './samples';
import { engineLoader } from '@/app/services';
import { ACCEPTED_EXTENSIONS } from '@/core/data/formats';

const PREVIEW_ROWS = 50;

function ImportBar() {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState<Sample | null>(null);
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
        accept={ACCEPTED_EXTENSIONS}
        hidden
        data-testid="csv-input"
        onChange={async (e) => {
          const f = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (f) await run(async () => importCsvFile(f.name, await f.arrayBuffer()));
        }}
      />
      <button disabled={busy} onClick={() => folderRef.current?.click()} data-testid="img-folder">{t('img.importFolder')}</button>
      <input ref={folderRef} type="file" hidden multiple {...{ webkitdirectory: '' }} onChange={async (e) => {
        const files = [...(e.currentTarget.files ?? [])];
        e.currentTarget.value = '';
        const root = ((files[0] as File & { webkitRelativePath?: string })?.webkitRelativePath ?? 'images').split('/')[0];
        if (files.length) await run(() => importImages(files, root));
      }} />
      <span className="muted small">{t('data.importHint')}</span>
      <div className="spacer" />
      <select value="" disabled={busy} data-testid="sample-select" onChange={(e) => {
        const s = SAMPLES.find((x) => x.id === e.currentTarget.value);
        if (s) { setSample(s); void run(async () => importCsvFile(s.fileName, await sampleBytes(s, (n) => engineLoader.load(n)), 'sample')); }
      }}>
        <option value="">{t('data.loadSample')}…</option>
        {SAMPLE_GROUPS.map((g) => (
          <optgroup key={g} label={t(`data.sampleGroup.${g}` as MessageKey)}>
            {SAMPLES.filter((s) => s.group === g).map((s) => <option key={s.id} value={s.id}>{t.text(s.label)}</option>)}
          </optgroup>
        ))}
      </select>
      {error && <div className="error-text small full">{error}</div>}
      {sample && !error && (
        <div className="sample-note small full" data-testid="sample-note">
          <div><strong>{t.text(sample.label)}</strong> · {t('lib.target')}: <code>{sample.target}</code></div>
          {sample.hint && <div>{t.text(sample.hint)}</div>}
          {sample.source && <div className="muted">{t('data.sampleSource')}: {sample.source.cite} · {sample.source.licence} · <a href={sample.source.url} target="_blank" rel="noopener noreferrer">{sample.source.url}</a></div>}
        </div>
      )}
      <details className="full sample-catalog">
        <summary>{t('data.sampleCatalog', { n: SAMPLES.length })}</summary>
        <div className="table-wrap">
          <table className="grid">
            <thead><tr><th>{t('data.sampleName')}</th><th>{t('lib.target')}</th><th>{t('data.sampleSize')}</th><th>{t('data.sampleSource')}</th><th>{t('data.sampleLicence')}</th></tr></thead>
            <tbody>
              {SAMPLES.map((s) => (
                <tr key={s.id}>
                  <td>{t.text(s.label)}</td><td><code>{s.target}</code></td><td className="num">{s.size}</td>
                  <td className="cite">{s.source ? <a href={s.source.url} target="_blank" rel="noopener noreferrer">{s.source.cite}</a> : t('data.sampleSynthetic')}</td>
                  <td>{s.source?.licence ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

type Tab = 'overview' | 'explore' | 'clean' | 'preview';

function Preview({ table }: { table: ColumnarTable }) {
  const t = useT();
  return (
    <div className="card">
      <h3>{t('data.preview', { n: Math.min(PREVIEW_ROWS, table.rowCount) })}</h3>
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
    </div>
  );
}

export function DataModule() {
  const t = useT();
  const datasetId = useUi((s) => s.datasetId);
  const project = useProject((s) => s.project);
  const { removeDataset, upsertPipeline } = useProject();
  const dataset = project?.datasets.find((d) => d.id === datasetId);
  const table = useTable(dataset?.id);
  const [tab, setTab] = useState<Tab>('overview');
  const [targetSel, setTarget] = useState<{ id: string; col: string } | null>(null);
  const target = targetSel && targetSel.id === dataset?.id ? targetSel.col : dataset?.columns.at(-1)?.name;
  const profile = useProfile(dataset?.id, table, target || undefined);
  const parent = dataset?.derivedFrom ? project?.datasets.find((d) => d.id === dataset.derivedFrom!.datasetId) : undefined;

  const setKind = (column: string, kind: ColumnKind) => {
    if (!dataset || !project) return;
    const pl = project.pipelines.filter((p) => p.inputDatasetId === dataset.id).at(-1);
    const step = { op: 'setKind' as const, column, kind };
    upsertPipeline(pl ? { ...pl, steps: [...pl.steps, step] } : newPipeline(newId('pl'), dataset, [step]));
    setTab('clean');
  };

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
              {parent && <button className="link" onClick={() => useUi.getState().selectDataset(parent.id)}>← {t('data.derivedFrom', { name: parent.name })}</button>}
              <div className="spacer" />
              <label className="small">
                {t('lib.target')}{' '}
                <select value={target} onChange={(e) => setTarget({ id: dataset.id, col: e.currentTarget.value })} data-testid="data-target">
                  {dataset.columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </label>
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
            {!dataset.images && <div className="tabs" role="tablist">
              {(['overview', 'explore', 'clean', 'preview'] as Tab[]).map((k) => (
                <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'tab active' : 'tab'} onClick={() => setTab(k)} data-testid={`tab-${k}`}>
                  {t(`data.tab.${k}` as MessageKey)}
                </button>
              ))}
            </div>}
          </div>
          {dataset.images && <ImageLabeler dataset={dataset} />}
          {!dataset.images && tab === 'overview' && (
            <>
              {profile?.profile ? <QualityReport profile={profile.profile} /> : <div className="card muted small">{profile?.error ?? t('quality.running')}</div>}
              <ColumnsTable dataset={dataset} onSetKind={setKind} />
            </>
          )}
          {!dataset.images && tab === 'explore' && (profile?.profile ? <Explore profile={profile.profile} /> : <div className="card muted small">{t('quality.running')}</div>)}
          {!dataset.images && tab === 'clean' && table && <Clean dataset={dataset} table={table} />}
          {!dataset.images && tab === 'preview' && table && <Preview table={table} />}
        </>
      )}
    </div>
  );
}
