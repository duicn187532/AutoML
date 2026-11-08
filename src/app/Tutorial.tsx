import { useState } from 'react';
import { useT, type MessageKey } from '@/i18n';
import { SAMPLES, sampleBytes } from '@/modules/data/samples';
import { importCsvFile } from './actions';
import { engineLoader } from './services';
import { useUi, type ModuleId } from './stores/ui';

const STEPS: { key: string; module: ModuleId }[] = [
  { key: 'import', module: 'data' },
  { key: 'quality', module: 'data' },
  { key: 'train', module: 'library' },
  { key: 'auto', module: 'auto' },
  { key: 'experiments', module: 'experiments' },
  { key: 'advanced', module: 'dag' },
];
const SEEN = 'aml.tutorialSeen';

export function shouldAutoOpenTutorial(): boolean {
  try { return !localStorage.getItem(SEEN); } catch { return false; }
}

/** Built-in guided tour using the Titanic sample (which also demonstrates leakage detection). */
export function Tutorial({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const step = STEPS[i];
  const close = () => { try { localStorage.setItem(SEEN, '1'); } catch { /* ignore */ } onClose(); };
  const go = async () => {
    if (step.key === 'import') {
      setBusy(true);
      try {
        const s = SAMPLES.find((x) => x.id === 'titanic')!;
        const d = await importCsvFile(s.fileName, await sampleBytes(s, () => engineLoader.load('samples')), 'sample');
        useUi.getState().selectDataset(d.id);
      } finally { setBusy(false); }
    }
    useUi.getState().setModule(step.module);
  };
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" data-testid="tutorial">
      <div className="modal">
        <div className="row"><h2>{t('tut.title')}</h2><span className="spacer" /><span className="small muted">{i + 1} / {STEPS.length}</span></div>
        <h3>{t(`tut.${step.key}.title` as MessageKey)}</h3>
        <p>{t(`tut.${step.key}.body` as MessageKey)}</p>
        <div className="row">
          <button className="primary" disabled={busy} onClick={go}>{busy ? '…' : t(`tut.${step.key}.action` as MessageKey)}</button>
          <span className="spacer" />
          <button disabled={i === 0} onClick={() => setI(i - 1)}>‹ {t('tut.prev')}</button>
          {i < STEPS.length - 1 ? <button onClick={() => setI(i + 1)}>{t('tut.next')} ›</button> : <button onClick={close}>{t('tut.done')}</button>}
          <button className="link" onClick={close}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
