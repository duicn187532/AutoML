import { useState } from 'react';
import { predictImages, trainImageModel, type ImageTrainSettings } from '@/app/actions';
import { fmtDuration, fmtMetric } from '@/app/format';
import { ENGINE_VERSIONS } from '@/app/services';
import { useProject } from '@/app/stores/project';
import { useTasks } from '@/app/stores/tasks';
import { EChart, confusionOption } from '@/charts/EChart';
import { LiveCurve } from '@/charts/LiveCurve';
import type { DatasetRecord } from '@/core/project/types';
import type { TrainImageOutput } from '@/core/workers/types';
import { useT, type MessageKey } from '@/i18n';

const BACKBONES = ['mobilenet-025', 'mobilenet-050', 'mobilenet-100'].filter((b) => b in ENGINE_VERSIONS);

/** Image classification: transfer learning (head / partial fine-tune) or a CNN from scratch; auto backbone comparison. */
export function ImageTrainer({ dataset }: { dataset: DatasetRecord }) {
  const t = useT();
  const project = useProject((s) => s.project)!;
  const [s, setS] = useState<ImageTrainSettings>({
    backbone: BACKBONES[0] ?? 'scratch', mode: BACKBONES.length ? 'head' : 'scratch', imageSize: 96, unfreeze: 4, epochs: 30, batchSize: 32,
    learningRate: 0.001, patience: 6, validFraction: 0.2, seed: project.seed, augment: { flip: true, crop: true, color: false },
  });
  const [taskId, setTaskId] = useState<string | null>(null);
  const [out, setOut] = useState<TrainImageOutput | null>(null);
  const [auto, setAuto] = useState<{ backbone: string; acc?: number; latency?: number; error?: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pred, setPred] = useState<{ name: string; url: string; top: string }[]>([]);
  const points = useTasks((st) => (taskId ? st.points[taskId] : undefined));
  const lastModel = project.models.filter((m) => m.pluginId === 'image' && m.datasetId === dataset.id)[0];
  const set = <K extends keyof ImageTrainSettings>(k: K, v: ImageTrainSettings[K]) => setS((x) => ({ ...x, [k]: v }));

  const run = async () => {
    setBusy(true); setError(null); setOut(null);
    try { setOut((await trainImageModel(dataset.id, s, setTaskId)).out); } catch (e) { if ((e as Error).name !== 'CancelledError') setError((e as Error).message); } finally { setBusy(false); }
  };
  const runAuto = async () => {
    setBusy(true); setError(null);
    const rows: { backbone: string; acc?: number; latency?: number; error?: string }[] = BACKBONES.map((b) => ({ backbone: b }));
    setAuto([...rows]);
    for (const r of rows) {
      try {
        const res = await trainImageModel(dataset.id, { ...s, backbone: r.backbone, mode: 'head' }, setTaskId);
        r.acc = res.out.metrics.accuracy; r.latency = res.out.latencyMs;
        setOut(res.out);
      } catch (e) { r.error = (e as Error).message; }
      setAuto([...rows]);
    }
    setBusy(false);
  };
  const best = auto?.filter((r) => r.acc !== undefined).sort((a, b) => b.acc! - a.acc! || a.latency! - b.latency!)[0];
  return (
    <div className="two-col">
      <div className="card form">
        <div className="field"><label>{t('img.mode')}</label>
          <select value={s.mode} onChange={(e) => set('mode', e.currentTarget.value as ImageTrainSettings['mode'])} data-testid="img-mode">
            {(['head', 'finetune', 'scratch'] as const).filter((m) => m === 'scratch' || BACKBONES.length).map((m) => <option key={m} value={m}>{t(`img.mode.${m}` as MessageKey)}</option>)}
          </select></div>
        {s.mode !== 'scratch' && <div className="field"><label>{t('img.backbone')}</label><select value={s.backbone} onChange={(e) => set('backbone', e.currentTarget.value)}>{BACKBONES.map((b) => <option key={b}>{b}</option>)}</select></div>}
        {s.mode === 'finetune' && <div className="field"><label>{t('img.unfreeze')}</label><input type="number" min={1} max={30} value={s.unfreeze} onChange={(e) => set('unfreeze', Number(e.currentTarget.value))} /></div>}
        {s.mode === 'scratch' && <div className="field"><label>{t('img.size')}</label><input type="number" min={32} max={224} step={16} value={s.imageSize} onChange={(e) => set('imageSize', Number(e.currentTarget.value))} /></div>}
        <div className="row2">
          {(['epochs', 'batchSize', 'learningRate', 'patience', 'validFraction', 'seed'] as const).map((k) => <div className="field" key={k}><label>{t(`dag.set.${k}` as MessageKey)}</label><input type="number" step="any" value={s[k]} onChange={(e) => set(k, Number(e.currentTarget.value))} /></div>)}
        </div>
        <div className="field"><label>{t('img.augment')}</label>
          <div className="checks inline">{(['flip', 'crop', 'color'] as const).map((k) => <label key={k} className="check"><input type="checkbox" checked={s.augment[k]} onChange={(e) => set('augment', { ...s.augment, [k]: e.currentTarget.checked })} />{t(`img.aug.${k}` as MessageKey)}</label>)}</div></div>
        <p className="small muted">{t(`img.hint.${s.mode}` as MessageKey)}</p>
        <div className="row">
          <button className="primary big" disabled={busy} onClick={run} data-testid="img-train">{busy ? t('lib.training') : t('lib.train')}</button>
          {BACKBONES.length > 1 && <button disabled={busy} onClick={runAuto} data-testid="img-auto">{t('img.auto')}</button>}
        </div>
        {!BACKBONES.length && <p className="small muted">{t('img.noBackbone')}</p>}
        {error && <div className="error-text">{error}</div>}
      </div>
      <div className="stack">
        {taskId && <div className="card"><h3>{t('lib.curve')}</h3><LiveCurve series={[{ label: 'img', points: points ?? [] }]} /></div>}
        {auto && (
          <div className="card" data-testid="img-auto-result">
            <h3>{t('img.auto')}</h3>
            <table className="grid"><thead><tr><th>backbone</th><th className="num">{t('metric.accuracy')}</th><th className="num">{t('img.latency')}</th></tr></thead>
              <tbody>{auto.map((r) => <tr key={r.backbone} className={r === best ? 'selected' : undefined}><td>{r.backbone}{r === best ? ' ★' : ''}</td><td className="num">{r.error ? r.error : fmtMetric('accuracy', r.acc)}</td><td className="num">{r.latency !== undefined ? `${r.latency.toFixed(1)} ms` : '…'}</td></tr>)}</tbody></table>
          </div>
        )}
        {out && (
          <div className="card" data-testid="img-result">
            <h3>{t('lib.result')} · {fmtDuration(out.durationMs)} · {t('img.latency')} {out.latencyMs.toFixed(1)} ms</h3>
            <div className="metrics">{(['accuracy', 'auc', 'macroF1', 'logLoss'] as const).map((m) => <div className="metric" key={m}><div className="metric-label">{t(`metric.${m}` as MessageKey)}</div><div className="metric-value">{fmtMetric(m, out.metrics[m])}</div></div>)}</div>
            <EChart option={confusionOption(out.confusion, out.classes, { truth: 'label', pred: 'predicted' })} height={Math.max(220, 40 * out.classes.length + 80)} />
          </div>
        )}
        {lastModel && (
          <div className="card">
            <h3>{t('img.try')}</h3>
            <input type="file" accept="image/*" multiple onChange={async (e) => {
              const files = [...(e.currentTarget.files ?? [])];
              e.currentTarget.value = '';
              const r = await predictImages(lastModel.id, files);
              setPred(files.map((f, i) => { const k = r.proba[i].indexOf(Math.max(...r.proba[i])); return { name: f.name, url: URL.createObjectURL(f), top: `${r.classes[k]} ${(r.proba[i][k] * 100).toFixed(1)}%` }; }));
            }} />
            <div className="thumbs">{pred.map((p) => <div key={p.url} className="thumb"><img src={p.url} alt={p.name} /><span className="thumb-label">{p.top}</span></div>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
