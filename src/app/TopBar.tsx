import { useRef, useState } from 'react';
import { safeFileName } from '@/core/security/escape';
import { LOCALES, useLocale, useT } from '@/i18n';
import { downloadBytes } from './actions';
import { Tutorial, shouldAutoOpenTutorial } from './Tutorial';
import { useProject } from './stores/project';
import { useTasks } from './stores/tasks';
import { useUi } from './stores/ui';

export function TopBar() {
  const t = useT();
  const { project, saveState, rename, setSeed, exportZip, importZip, newProject } = useProject();
  const { locale, setLocale } = useLocale();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [tour, setTour] = useState(shouldAutoOpenTutorial);
  const [menu, setMenu] = useState(false);
  const { drawer, setDrawer } = useUi();
  const active = useTasks((s) => s.tasks.filter((x) => x.status === 'running' || x.status === 'queued').length);
  if (!project) return <header className="topbar" />;

  const onExport = async () => {
    setBusy(true);
    try {
      const bytes = await exportZip();
      downloadBytes(bytes, `${safeFileName(project.name, 'project')}.aml.zip`, 'application/zip');
    } finally {
      setBusy(false);
    }
  };
  const onImport = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      await importZip(new Uint8Array(await f.arrayBuffer()));
      useUi.getState().selectDataset(null);
    } catch (e) {
      alert(t('project.importFailed', { error: (e as Error).message }));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo" aria-hidden="true">◆</span>
        <span className="brand-text">{t('app.title')}</span>
      </div>
      <input
        className="project-name"
        aria-label={t('project.rename')}
        defaultValue={project.name}
        key={project.id + project.name}
        onBlur={(e) => rename(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <span className={`save-state ${saveState}`} title={t('app.offline')}>
        {saveState === 'saving' ? t('project.saving') : saveState === 'error' ? t('project.saveError') : t('project.saved')}
      </span>
      <div className="spacer" />
      <button className="icon-btn drawer-toggle" onClick={() => setDrawer(!drawer)} aria-expanded={drawer} aria-controls="side-panel" title={`${t('panel.data')} / ${t('panel.tasks')}`}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        {active > 0 && <span className="dot">{active}</span>}
      </button>
      <button className="icon-btn menu-toggle" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="menu">⋯</button>
      {menu && <div className="menu-backdrop" onClick={() => setMenu(false)} aria-hidden="true" />}
      <div className={menu ? 'top-actions open' : 'top-actions'} onClick={(e) => (e.target as HTMLElement).tagName === 'BUTTON' && setMenu(false)}>
      <label className="seed" title={t('project.seed')}>
        seed
        <input type="number" min={0} value={project.seed} onChange={(e) => setSeed(Number(e.currentTarget.value))} />
      </label>
      <button
        onClick={async () => {
          if (confirm(t('project.confirmNew'))) {
            await newProject();
            useUi.getState().selectDataset(null);
          }
        }}
      >
        {t('project.new')}
      </button>
      <button onClick={() => fileRef.current?.click()} disabled={busy}>
        {t('project.import')}
      </button>
      <input ref={fileRef} type="file" accept=".zip,application/zip" hidden onChange={(e) => onImport(e.currentTarget.files?.[0])} data-testid="import-zip" />
      <button className="primary" onClick={onExport} disabled={busy} data-testid="export-zip">
        {t('project.export')}
      </button>
      <button className="link" onClick={() => setTour(true)} data-testid="open-tutorial">{t('tut.open')}</button>
      <select aria-label={t('app.language')} value={locale} onChange={(e) => setLocale(e.currentTarget.value as typeof locale)}>
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {l === 'zh-TW' ? '繁體中文' : 'English'}
          </option>
        ))}
      </select>
      </div>
      {tour && <Tutorial onClose={() => setTour(false)} />}
    </header>
  );
}
