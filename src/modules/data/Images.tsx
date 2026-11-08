import { useEffect, useMemo, useRef, useState } from 'react';
import { importImages, setImageLabels } from '@/app/actions';
import { useProject } from '@/app/stores/project';
import type { DatasetRecord } from '@/core/project/types';
import type { ImagePack } from '@/core/workers/tasks/images';
import { useT } from '@/i18n';
import { newId } from '@/core/util/id';
import { useTable } from './hooks';

const PAGE = 120;

/** Thumbnail grid labeling tool: click to select (Shift for range), keys 1–9 assign a class, 0 clears; webcam capture. */
export function ImageLabeler({ dataset }: { dataset: DatasetRecord }) {
  const t = useT();
  const getImages = useProject((s) => s.getImages);
  const table = useTable(dataset.id);
  const [pack, setPack] = useState<{ id: string; pack: ImagePack } | null>(null);
  const [labels, setLabels] = useState<(string | null)[] | null>(null);
  const [extraClasses, setExtra] = useState<string[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [filter, setFilter] = useState<string>('__all__');
  const [page, setPage] = useState(0);
  const [newClass, setNewClass] = useState('');
  const [cam, setCam] = useState<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getImages(dataset.id).then((p) => alive && setPack({ id: dataset.id, pack: p })).catch((e) => setError(e.message));
    return () => { alive = false; };
  }, [dataset, getImages]);
  const tableLabels = useMemo(() => {
    const c = table?.columns.find((x) => x.name === 'label');
    return c && c.kind !== 'numeric' ? c.values : null;
  }, [table]);
  const cur = useMemo(() => labels ?? tableLabels ?? [], [labels, tableLabels]);
  const classes = useMemo(() => [...new Set([...cur.filter((x): x is string => !!x), ...extraClasses])].sort(), [cur, extraClasses]);
  const p = pack?.id === dataset.id ? pack.pack : null;
  const visible = useMemo(() => cur.map((_, i) => i).filter((i) => filter === '__all__' || (filter === '__none__' ? cur[i] === null : cur[i] === filter)), [cur, filter]);
  const shown = visible.slice(page * PAGE, (page + 1) * PAGE);
  const urls = useMemo(() => (p ? new Map(shown.map((i) => [i, URL.createObjectURL(new Blob([p.data[i] as BlobPart], { type: 'image/jpeg' }))])) : new Map<number, string>()), [p, shown]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const assign = (label: string | null) => {
    if (!sel.length) return;
    const next = [...cur];
    sel.forEach((i) => { next[i] = label; });
    setLabels(next);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (/^[1-9]$/.test(e.key) && classes[Number(e.key) - 1]) assign(classes[Number(e.key) - 1]);
      if (e.key === '0') assign(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => { if (video.current && cam) video.current.srcObject = cam; }, [cam]);
  useEffect(() => () => cam?.getTracks().forEach((tr) => tr.stop()), [cam]);

  const dirty = labels !== null;
  const save = async () => { if (labels) { await setImageLabels(dataset.id, labels); setLabels(null); } };
  const capture = async (label: string | null) => {
    if (!video.current) return;
    const c = document.createElement('canvas');
    c.width = video.current.videoWidth; c.height = video.current.videoHeight;
    c.getContext('2d')!.drawImage(video.current, 0, 0);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
    if (dirty) await save();
    await importImages([new File([blob], `webcam-${newId()}.jpg`, { type: 'image/jpeg' })], dataset.name, dataset.id, label);
  };
  const counts = classes.map((c) => [c, cur.filter((x) => x === c).length] as const);
  return (
    <div className="card" data-testid="labeler">
      <div className="row">
        <h3>{t('img.labeler')}</h3>
        <span className="small muted">{t('img.counts', { n: cur.length, unlabeled: cur.filter((x) => x === null).length })}</span>
        <span className="spacer" />
        <button className="primary" disabled={!dirty} onClick={save} data-testid="labels-save">{t('img.save')}</button>
      </div>
      <div className="row">
        {counts.map(([c, n], i) => <button key={c} onClick={() => assign(c)} title={t('img.assign')}>{i < 9 ? `${i + 1} · ` : ''}{c} ({n})</button>)}
        <button onClick={() => assign(null)}>0 · {t('img.unlabel')}</button>
        <input placeholder={t('img.newClass')} value={newClass} onChange={(e) => setNewClass(e.currentTarget.value)} style={{ width: 140 }} />
        <button disabled={!newClass.trim()} onClick={() => { setExtra((x) => [...x, newClass.trim()]); setNewClass(''); }}>+</button>
      </div>
      <div className="row">
        <select value={filter} onChange={(e) => { setFilter(e.currentTarget.value); setPage(0); }}>
          <option value="__all__">{t('img.all')}</option>
          <option value="__none__">{t('img.unlabeled')}</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="link" onClick={() => setSel(shown)}>{t('img.selectPage')}</button>
        <button className="link" onClick={() => setSel([])}>{t('img.clearSel')}</button>
        <span className="small muted">{sel.length} {t('img.selected')} · {t('img.keys')}</span>
        <span className="spacer" />
        {visible.length > PAGE && <><button disabled={!page} onClick={() => setPage(page - 1)}>‹</button><span className="small">{page + 1}/{Math.ceil(visible.length / PAGE)}</span><button disabled={(page + 1) * PAGE >= visible.length} onClick={() => setPage(page + 1)}>›</button></>}
        {!cam ? <button onClick={async () => { try { setCam(await navigator.mediaDevices.getUserMedia({ video: true })); } catch (e) { setError((e as Error).message); } }}>{t('img.webcam')}</button>
          : <button onClick={() => { cam.getTracks().forEach((tr) => tr.stop()); setCam(null); }}>{t('img.webcamStop')}</button>}
      </div>
      {cam && (
        <div className="row webcam">
          <video ref={video} autoPlay playsInline muted width={240} />
          <div className="small muted">{t('img.capture')}</div>
          {classes.map((c) => <button key={c} onClick={() => capture(c)}>📷 {c}</button>)}
          <button onClick={() => capture(null)}>📷 {t('img.unlabeled')}</button>
        </div>
      )}
      {error && <div className="error-text small">{error}</div>}
      <div className="thumbs">
        {shown.map((i, k) => (
          <button key={i} className={sel.includes(i) ? 'thumb sel' : 'thumb'} onClick={(e) => {
            if (e.shiftKey && sel.length) { const last = shown.indexOf(sel[sel.length - 1]); const [a, b] = [Math.min(last, k), Math.max(last, k)]; setSel([...new Set([...sel, ...shown.slice(a, b + 1)])]); }
            else if (e.ctrlKey || e.metaKey) setSel(sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i]);
            else setSel([i]);
          }}>
            {urls.get(i) && <img src={urls.get(i)} alt={p?.names[i] ?? ''} loading="lazy" />}
            <span className={cur[i] ? 'thumb-label' : 'thumb-label none'}>{cur[i] ?? '—'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
