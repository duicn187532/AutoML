import { useRef, useState } from 'react';
import { importCsvFile, importImages } from '@/app/actions';
import { ImageLabeler } from './Images';
import { fmtBytes } from '@/app/format';
import { useProject } from '@/app/stores/project';
import { useUi } from '@/app/stores/ui';
import { cellString, getColumn, type ColumnKind, type ColumnarTable } from '@/core/data/table';
import { newId } from '@/core/util/id';
import { newPipeline } from '@/core/project/types';
import { datasetTarget } from '@/core/project/target';
import { Clean } from './Clean';
import { Explore } from './Explore';
import { useProfile, useTable } from './hooks';
import { ColumnsTable, QualityReport } from './Overview';
import { useT, type MessageKey } from '@/i18n';
import { PageHeader } from '@/app/ui/Page';
import { BRAND } from '@/app/brand';
import { inferTask } from '@/core/ml/preprocess';
import { SAMPLES, SAMPLE_GROUPS, sampleBytes, type Sample } from './samples';
import { engineLoader } from '@/app/services';
import { ACCEPTED_EXTENSIONS } from '@/core/data/formats';

const PREVIEW_ROWS = 50;

/** Shared import logic for the first-run hero and the compact bar. */
function useImporter() {
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
  const importFile = (f: File) => run(async () => importCsvFile(f.name, await f.arrayBuffer()));
  const loadSample = (s: Sample) => { setSample(s); return run(async () => importCsvFile(s.fileName, await sampleBytes(s, (n) => engineLoader.load(n)), 'sample', s.target)); };
  return { error, busy, sample, run, importFile, loadSample };
}
type Importer = ReturnType<typeof useImporter>;

const FEATURED = ['titanic', 'iris', 'diabetes', 'air-passengers'];

function FileInputs({ imp, inputRef, folderRef }: { imp: Importer; inputRef: React.RefObject<HTMLInputElement | null>; folderRef: React.RefObject<HTMLInputElement | null> }) {
  return (
    <>
      <input ref={inputRef} type="file" accept={ACCEPTED_EXTENSIONS} hidden data-testid="csv-input" onChange={async (e) => {
        const f = e.currentTarget.files?.[0];
        e.currentTarget.value = '';
        if (f) await imp.importFile(f);
      }} />
      <input ref={folderRef} type="file" hidden multiple {...{ webkitdirectory: '' }} onChange={async (e) => {
        const files = [...(e.currentTarget.files ?? [])];
        e.currentTarget.value = '';
        const root = ((files[0] as File & { webkitRelativePath?: string })?.webkitRelativePath ?? 'images').split('/')[0];
        if (files.length) await imp.run(() => importImages(files, root));
      }} />
    </>
  );
}

function SampleSelect({ imp, label }: { imp: Importer; label: string }) {
  const t = useT();
  return (
    <select value="" disabled={imp.busy} data-testid="sample-select" onChange={(e) => {
      const s = SAMPLES.find((x) => x.id === e.currentTarget.value);
      if (s) void imp.loadSample(s);
    }}>
      <option value="">{label}</option>
      {SAMPLE_GROUPS.map((g) => (
        <optgroup key={g} label={t(`data.sampleGroup.${g}` as MessageKey)}>
          {SAMPLES.filter((s) => s.group === g).map((s) => <option key={s.id} value={s.id}>{t.text(s.label)}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function SampleNote({ imp }: { imp: Importer }) {
  const t = useT();
  const sample = imp.sample;
  if (!sample || imp.error) return null;
  return (
    <div className="sample-note small full" data-testid="sample-note">
      <div><strong>{t.text(sample.label)}</strong> · {t('lib.target')}: <code>{sample.target}</code></div>
      {sample.hint && <div>{t.text(sample.hint)}</div>}
      {sample.source && <div className="muted">{t('data.sampleSource')}: {sample.source.cite} · {sample.source.licence} · <a href={sample.source.url} target="_blank" rel="noopener noreferrer">{sample.source.url}</a></div>}
    </div>
  );
}

function SampleCatalog() {
  const t = useT();
  return (
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
  );
}

/** Accept a dropped data file anywhere inside the wrapped area. */
function useDrop(imp: Importer) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } },
      onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void imp.importFile(f);
      },
    },
  };
}

/** First run: big drop zone and one-click samples. */
function ImportHero({ imp }: { imp: Importer }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const drop = useDrop(imp);
  return (
    <div className="hero">
      <div className={drop.over ? 'dropzone over' : 'dropzone'} {...drop.props} data-testid="dropzone">
        <div className="dropzone-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="34" height="34"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2>{drop.over ? t('data.hero.drop') : t('data.hero.title')}</h2>
        <p className="muted">{t('data.hero.body')}</p>
        <div className="row center">
          <button className="primary big" disabled={imp.busy} onClick={() => inputRef.current?.click()}>{imp.busy ? '…' : t('data.import')}</button>
          <button className="big" disabled={imp.busy} onClick={() => folderRef.current?.click()} data-testid="img-folder">{t('img.importFolder')}</button>
        </div>
        <span className="orei-pill"><img src={BRAND.orei} alt="" />{t('data.hero.oreiPromise')}</span>
        <FileInputs imp={imp} inputRef={inputRef} folderRef={folderRef} />
      </div>
      {imp.error && <div className="error-text">{imp.error}</div>}
      <h3 className="hero-sub">{t('data.hero.try')}</h3>
      <div className="sample-cards">
        {FEATURED.map((id) => SAMPLES.find((s) => s.id === id)).filter((s): s is Sample => !!s).map((s) => (
          <button key={s.id} className="sample-card" disabled={imp.busy} onClick={() => void imp.loadSample(s)} data-testid={`sample-card-${s.id}`}>
            <span className="sample-card-group">{t(`data.sampleGroup.${s.group}` as MessageKey)}</span>
            <strong>{t.text(s.label)}</strong>
            <span className="small muted">{s.size} · {t('lib.target')} <code>{s.target}</code></span>
          </button>
        ))}
      </div>
      <div className="row">
        <SampleSelect imp={imp} label={t('data.hero.more')} />
      </div>
      <SampleCatalog />
    </div>
  );
}

/** Once a dataset exists: compact import row. */
function ImportBar({ imp }: { imp: Importer }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const drop = useDrop(imp);
  return (
    <div className={drop.over ? 'card import-bar over' : 'card import-bar'} {...drop.props}>
      <button className="primary" disabled={imp.busy} onClick={() => inputRef.current?.click()}>
        {t('data.import')}
      </button>
      <button disabled={imp.busy} onClick={() => folderRef.current?.click()} data-testid="img-folder">{t('img.importFolder')}</button>
      <SampleSelect imp={imp} label={`${t('data.loadSample')}…`} />
      <span className="muted small import-hint">{t('data.importHint')}</span>
      <FileInputs imp={imp} inputRef={inputRef} folderRef={folderRef} />
      {imp.error && <div className="error-text small full">{imp.error}</div>}
      <SampleNote imp={imp} />
      <SampleCatalog />
    </div>
  );
}

/** "What now?" strip under the dataset header: names the target and task and points to training. */
function NextStep({ target, table }: { target: string; table: ColumnarTable | null | undefined }) {
  const t = useT();
  if (!table || !target || !table.columns.some((c) => c.name === target)) return null;
  const task = inferTask(getColumn(table, target));
  return (
    <div className="next-step" data-testid="next-step">
      <img className="next-step-art" src={BRAND.peek} alt="" />
      <div className="next-step-text">
        <strong>{t('data.next.title')}</strong>
        <span>{t('data.next.ready')} {t('data.next.body', { target, task: t(`task.kind.${task}` as MessageKey) })}</span>
      </div>
      <button className="primary" onClick={() => useUi.getState().setModule('auto')} data-testid="next-auto">{t('data.next.auto')} →</button>
      <button onClick={() => useUi.getState().setModule('library')}>{t('data.next.library')}</button>
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
  const imp = useImporter();
  const target = dataset ? datasetTarget(dataset) : undefined;
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
      <PageHeader id="data" art={dataset ? undefined : BRAND.hero} banner />
      {!dataset ? (
        <ImportHero imp={imp} />
      ) : (
        <>
          <ImportBar imp={imp} />
          <div className="card dataset-card">
            <div className="row">
              <h2>{dataset.name}</h2>
              <span className="muted">
                {t('data.rows', { n: dataset.rowCount.toLocaleString() })} · {t('data.cols', { n: dataset.columns.length })}
                {dataset.source.bytes ? ` · ${fmtBytes(dataset.source.bytes)}` : ''} · v{dataset.hash.slice(0, 8)}
              </span>
              {parent && <button className="link" onClick={() => useUi.getState().selectDataset(parent.id)}>← {t('data.derivedFrom', { name: parent.name })}</button>}
              <div className="spacer" />
              <label className="target-pick">
                {t('lib.target')}
                <select value={target} onChange={(e) => useProject.getState().setDatasetTarget(dataset.id, e.currentTarget.value)} data-testid="data-target">
                  {dataset.columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </label>
              <button className="danger ghost" onClick={() => { if (confirm(t('data.confirmDelete', { name: dataset.name }))) { removeDataset(dataset.id); useUi.getState().selectDataset(null); } }}>
                {t('data.delete')}
              </button>
            </div>
            {dataset.warnings?.length ? (
              <details className="warn">
                <summary>{t('data.warnings')} ({dataset.warnings.length})</summary>
                <ul>{dataset.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </details>
            ) : null}
            {!dataset.images && <NextStep target={target ?? ''} table={table} />}
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
