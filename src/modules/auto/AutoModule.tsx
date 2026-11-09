import { useState } from 'react';
import { downloadBytes, runAuto } from '@/app/actions';
import { CLASSIFICATION_METRICS, REGRESSION_METRICS, fmtBytes, fmtDuration, fmtMetric } from '@/app/format';
import { useProject } from '@/app/stores/project';
import { useTasks } from '@/app/stores/tasks';
import { useUi } from '@/app/stores/ui';
import { LiveCurve } from '@/charts/LiveCurve';
import type { Preset } from '@/core/auto/portfolio';
import { getColumn } from '@/core/data/table';
import { inferTask } from '@/core/ml/preprocess';
import { datasetTarget } from '@/core/project/target';
import { safeFileName } from '@/core/security/escape';
import type { AutoOutput } from '@/core/workers/types';
import { useT, type MessageKey } from '@/i18n';
import { useLeakage, useTable } from '../data/hooks';
import { MascotNote, NeedData, PageHeader } from '@/app/ui/Page';
import { BRAND } from '@/app/brand';

const BUDGET: Record<Preset, number> = { fast: 60, balanced: 300, best: 900 };

export function AutoModule() {
  const t = useT();
  const project = useProject((s) => s.project)!;
  const datasetId = useUi((s) => s.datasetId) ?? project.datasets[0]?.id;
  const dataset = project.datasets.find((d) => d.id === datasetId);
  const table = useTable(dataset?.id);
  const target = dataset ? datasetTarget(dataset) : '';
  const leak = useLeakage(dataset?.id, table, target || undefined);
  const [keepLeakFor, setKeepLeakFor] = useState<string | null>(null);
  const keepLeak = keepLeakFor === `${dataset?.id}|${target}`;
  const [preset, setPreset] = useState<Preset>('balanced');
  const [budget, setBudget] = useState<number | null>(null);
  const [testFraction, setTestFraction] = useState(0.2);
  const [seed, setSeed] = useState(project.seed);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [result, setResult] = useState<{ out: AutoOutput; card: string; expId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const task = table && target ? inferTask(getColumn(table, target)) : null;
  const live = useTasks((s) => (taskId ? s.tasks.find((x) => x.id === taskId) : undefined));
  const points = useTasks((s) => (taskId ? s.points[taskId] : undefined));
  const running = live?.status === 'running' || live?.status === 'queued';

  if (!dataset) return <NeedData id="auto" />;
  const excluded = keepLeak ? [] : leak.columns;
  const features = dataset.columns.filter((c) => c.name !== target && c.kind !== 'id' && c.kind !== 'text' && !excluded.includes(c.name)).map((c) => c.name);

  const run = async () => {
    if (!task) return;
    setError(null);
    setResult(null);
    try {
      setResult(await runAuto({ datasetId: dataset.id, target, features, task, preset, timeBudgetSec: budget ?? BUDGET[preset], testFraction, seed }, setTaskId));
    } catch (e) {
      if ((e as Error).name !== 'CancelledError') setError((e as Error).message);
    }
  };

  const openInLibrary = (pluginId: string, params: Record<string, number | string | boolean>) => {
    useUi.getState().setLibraryPrefill({ datasetId: dataset.id, target, pluginId, params });
    useUi.getState().setModule('library');
  };

  const metrics = task === 'regression' ? REGRESSION_METRICS : CLASSIFICATION_METRICS;
  return (
    <div className="module">
      <PageHeader id="auto" art={BRAND.pounce} />
      <div className="card form auto-form">
        <div className="form-grid">
          <div className="field">
            <label>{t('exp.dataset')}</label>
            <select value={dataset.id} onChange={(e) => useUi.getState().selectDataset(e.currentTarget.value)}>
              {project.datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('lib.target')}</label>
            <select value={target} onChange={(e) => useProject.getState().setDatasetTarget(dataset.id, e.currentTarget.value)} data-testid="auto-target">
              {dataset.columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('auto.budget')}</label>
            <input type="number" min={10} max={7200} value={budget ?? BUDGET[preset]} onChange={(e) => setBudget(Number(e.currentTarget.value))} />
          </div>
        </div>
        {task && (
          <div className="chips">
            <span className="chip accent">{t(`task.kind.${task}` as MessageKey)}</span>
            <span className="chip">{t('auto.features', { n: features.length })}</span>
            <span className="chip">{t('data.rows', { n: dataset.rowCount.toLocaleString() })}</span>
          </div>
        )}
        {leak.columns.length > 0 && (
          <MascotNote who="hachiman" testId="leak-note" title={t(keepLeak ? 'auto.leakKeptTitle' : 'auto.leakTitle', { cols: leak.columns.join(', ') })}>
            {t(keepLeak ? 'auto.leakKeptWhy' : 'auto.leakWhy')}{' '}
            <button className="link" onClick={() => setKeepLeakFor(keepLeak ? null : `${dataset.id}|${target}`)}>{t(keepLeak ? 'auto.leakExclude' : 'auto.leakKeep')}</button>
          </MascotNote>
        )}
        <h3 className="presets-title">{t('auto.presetsTitle')}</h3>
        <div className="presets" role="radiogroup">
          {(['fast', 'balanced', 'best'] as Preset[]).map((p) => (
            <label key={p} className={preset === p ? 'preset active' : 'preset'}>
              <input type="radio" name="preset" checked={preset === p} onChange={() => { setPreset(p); setBudget(null); }} />
              <strong>{t(`auto.preset.${p}` as MessageKey)}</strong>
              <span className="small muted">{t(`auto.preset.${p}.hint` as MessageKey)}</span>
            </label>
          ))}
        </div>
        <details className="advanced">
          <summary>{t('auto.advanced')}</summary>
          <div className="form-grid">
            <div className="field">
              <label>{t('lib.test')}</label>
              <input type="number" min={0} max={0.4} step={0.05} value={testFraction} onChange={(e) => setTestFraction(Number(e.currentTarget.value))} />
            </div>
            <div className="field">
              <label>{t('lib.seed')}</label>
              <input type="number" min={0} value={seed} onChange={(e) => setSeed(Number(e.currentTarget.value) >>> 0)} />
            </div>
          </div>
          <p className="small muted">{t('auto.how')}</p>
        </details>
        <div className="form-actions">
          <button className="primary big" disabled={running || !table || !leak.ready} onClick={run} data-testid="auto-run">{running ? t('lib.training') : `${t('auto.run')} →`}</button>
        </div>
        {error && <div className="error-text">{error}</div>}
      </div>
      {taskId && (
        <div className="card">
          <h3>{t('auto.progress')}</h3>
          {live && <p className="small muted">{live.engineLoading ? t('task.loadingEngine', { name: live.engineLoading.name, pct: Math.round(live.engineLoading.fraction * 100) }) : live.message}</p>}
          <LiveCurve series={[{ label: 'best', points: points ?? [] }]} x="epoch" y={['loss']} height={160} />
        </div>
      )}
      {result && (
        <>
          <div className="card" data-testid="auto-result">
            <h3>{t('auto.ensemble')}</h3>
            <div className="metrics">
              {metrics.map((m) => (
                <div className="metric" key={m}>
                  <div className="metric-label">{t(`metric.${m}` as MessageKey)} · OOF</div>
                  <div className="metric-value">{fmtMetric(m, result.out.ensemble.oof[m])}</div>
                  {result.out.ensemble.test && <div className="metric-sub"><strong>{t('lib.metricTest')} {fmtMetric(m, result.out.ensemble.test[m])}</strong></div>}
                </div>
              ))}
            </div>
            <p className="small muted">
              {result.out.ensemble.weights.filter((w) => w.weight > 0).map((w) => `${w.label} ${(w.weight * 100).toFixed(0)}%`).join(' · ')} · {fmtDuration(result.out.durationMs)}
            </p>
          </div>
          <div className="card">
            <h3>Leaderboard</h3>
            <div className="table-wrap">
              <table className="grid" data-testid="auto-leaderboard">
                <thead>
                  <tr>
                    <th>#</th><th>{t('exp.model')}</th>
                    {metrics.map((m) => <th key={m} className="num">{t(`metric.${m}` as MessageKey)} (CV)</th>)}
                    {result.out.nTest > 0 && <th className="num">{t('lib.metricTest')} {t(`metric.${metrics[0]}` as MessageKey)}</th>}
                    <th className="num">folds</th><th className="num">{t('auto.fitTime')}</th><th className="num">{t('auto.predictTime')}</th><th className="num">size</th><th className="num">{t('auto.weight')}</th><th />
                  </tr>
                </thead>
                <tbody>
                  {result.out.candidates.map((c, i) => (
                    <tr key={c.id} className={c.weight ? 'selected' : undefined}>
                      <td>{i + 1}</td>
                      <td title={c.error ?? JSON.stringify(c.params)}>{c.label}{c.source === 'search' ? ' 🔍' : ''}{c.error ? ' ⚠' : ''}</td>
                      {metrics.map((m) => <td key={m} className="num">{fmtMetric(m, c.cv?.mean[m])}{c.cv && <span className="muted small"> ±{fmtMetric(m, c.cv.std[m])}</span>}</td>)}
                      {result.out.nTest > 0 && <td className="num">{fmtMetric(metrics[0], c.test?.[metrics[0]])}</td>}
                      <td className="num">{c.foldsDone}</td>
                      <td className="num">{fmtDuration(c.fitMs)}</td>
                      <td className="num">{c.predictMsPer1k !== undefined ? `${c.predictMsPer1k.toFixed(1)} ms/1k` : '—'}</td>
                      <td className="num">{c.sizeBytes ? fmtBytes(c.sizeBytes) : '—'}</td>
                      <td className="num">{c.weight ? `${(c.weight * 100).toFixed(0)}%` : ''}</td>
                      <td><button className="link" onClick={() => openInLibrary(c.pluginId, c.params)}>{t('auto.openInLibrary')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="row">
              <h3>Model card</h3>
              <span className="spacer" />
              <button onClick={() => downloadBytes(result.card, `${safeFileName(`${dataset.name}-${target}`)}-model-card.md`, 'text/markdown')}>{t('auto.downloadCard')}</button>
            </div>
            <pre className="model-card">{result.card}</pre>
          </div>
        </>
      )}
    </div>
  );
}
