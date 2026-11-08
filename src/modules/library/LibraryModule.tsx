import { useEffect, useMemo, useState } from 'react';
import { startTraining } from '@/app/actions';
import { CLASSIFICATION_METRICS, REGRESSION_METRICS, fmtDuration, fmtMetric } from '@/app/format';
import { useProject } from '@/app/stores/project';
import { useTasks } from '@/app/stores/tasks';
import { useUi } from '@/app/stores/ui';
import { ParamForm } from '@/app/ui/ParamForm';
import { EChart, confusionOption, rocOption } from '@/charts/EChart';
import { LiveCurve } from '@/charts/LiveCurve';
import type { MetricName } from '@/core/ml/metrics';
import { DEFAULT_PREPROCESS, inferTask, type TaskKind } from '@/core/ml/preprocess';
import { defaultParams } from '@/core/models/params';
import { getPlugin, listPlugins } from '@/core/models/registry';
import type { ParamValues } from '@/core/models/types';
import type { DatasetRecord, ExperimentRecord } from '@/core/project/types';
import { getColumn, type ColumnarTable } from '@/core/data/table';
import { useT, type MessageKey } from '@/i18n';

export function ExperimentResult({ exp }: { exp: ExperimentRecord }) {
  const t = useT();
  const names: MetricName[] = exp.task === 'regression' ? REGRESSION_METRICS : CLASSIFICATION_METRICS;
  const confusion = useMemo(
    () => (exp.confusion && exp.classes ? confusionOption(exp.confusion, exp.classes, { truth: exp.config.target, pred: 'predicted' }) : null),
    [exp],
  );
  const roc = useMemo(() => (exp.roc ? rocOption(exp.roc, exp.metrics?.valid.auc) : null), [exp]);
  return (
    <div className="card" data-testid="result">
      <div className="row">
        <h3>{t('lib.result')} · {exp.name}</h3>
        <span className="muted small">
          n<sub>train</sub>={exp.nTrain} · n<sub>valid</sub>={exp.nValid} · {fmtDuration(exp.durationMs)}
          {exp.bestEpoch ? ` · best epoch ${exp.bestEpoch}` : ''}
        </span>
      </div>
      <div className="metrics">
        {names.map((m) => (
          <div className="metric" key={m} data-testid={`metric-${m}`}>
            <div className="metric-label">{t(`metric.${m}` as MessageKey)}</div>
            <div className="metric-value">{fmtMetric(m, exp.metrics?.valid[m])}</div>
            <div className="metric-sub muted">train {fmtMetric(m, exp.metrics?.train[m])}</div>
          </div>
        ))}
      </div>
      {exp.skippedColumns?.length ? <p className="small muted">{t('lib.skipped', { cols: exp.skippedColumns.map((s) => `${s.column} (${s.reason})`).join(', ') })}</p> : null}
      {exp.notes?.length ? <p className="small muted">{exp.notes.join(' · ')}</p> : null}
      <div className="chart-grid">
        {confusion && (
          <div>
            <h4>{t('lib.confusion')}</h4>
            <EChart option={confusion} height={Math.max(220, 40 * (exp.classes?.length ?? 2) + 80)} />
          </div>
        )}
        {roc && (
          <div>
            <h4>ROC</h4>
            <EChart option={roc} height={260} />
          </div>
        )}
      </div>
    </div>
  );
}

export function LibraryModule() {
  const t = useT();
  const project = useProject((s) => s.project)!;
  const getTable = useProject((s) => s.getTable);
  const datasetId = useUi((s) => s.datasetId) ?? project.datasets[0]?.id ?? null;
  const dataset = project.datasets.find((d) => d.id === datasetId);
  const [loaded, setLoaded] = useState<{ id: string; table: ColumnarTable } | null>(null);

  useEffect(() => {
    let alive = true;
    if (dataset) getTable(dataset.id).then((table) => alive && setLoaded({ id: dataset.id, table })).catch(console.error);
    return () => { alive = false; };
  }, [dataset, getTable]);

  if (!dataset) return <div className="module"><h1>{t('nav.library')}</h1><p className="muted">{t('panel.data.empty')}</p></div>;
  if (loaded?.id !== dataset.id) return <div className="module"><h1>{t('nav.library')}</h1></div>;
  return <LibraryForm key={dataset.id} dataset={dataset} table={loaded.table} />;
}

const defaultFeatures = (d: DatasetRecord, target: string) =>
  d.columns.filter((c) => c.name !== target && c.kind !== 'id' && c.kind !== 'text').map((c) => c.name);

function LibraryForm({ dataset, table }: { dataset: DatasetRecord; table: ColumnarTable }) {
  const t = useT();
  const project = useProject((s) => s.project)!;
  const taskOf = (col: string) => inferTask(getColumn(table, col));
  const initialTarget = dataset.columns[dataset.columns.length - 1]?.name ?? '';

  const [target, setTarget] = useState(initialTarget);
  const [features, setFeatures] = useState<string[]>(() => defaultFeatures(dataset, initialTarget));
  const inferred: TaskKind = useMemo(() => inferTask(getColumn(table, target)), [table, target]);
  const [pluginId, setPluginId] = useState(() => listPlugins(taskOf(initialTarget))[0].id);
  const [params, setParams] = useState<ParamValues>(() => defaultParams(getPlugin(pluginId), taskOf(initialTarget)));
  const [validFraction, setValidFraction] = useState(0.2);
  const [seed, setSeed] = useState(project.seed);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [expId, setExpId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plugins = listPlugins(inferred);

  const changeTarget = (v: string) => {
    setTarget(v);
    setFeatures((f) => f.filter((x) => x !== v));
    const task = taskOf(v);
    if (!getPlugin(pluginId).tasks.includes(task)) {
      const p = listPlugins(task)[0];
      setPluginId(p.id);
      setParams(defaultParams(p, task));
    }
  };

  const task = useTasks((s) => (taskId ? s.tasks.find((x) => x.id === taskId) : undefined));
  const points = useTasks((s) => (taskId ? s.points[taskId] : undefined));
  const exp = project.experiments.find((e) => e.id === expId);
  const plugin = getPlugin(pluginId);
  const running = task?.status === 'running' || task?.status === 'queued';

  const train = async () => {
    setError(null);
    if (!target) return setError(t('lib.noTarget'));
    const feats = features.filter((f) => f !== target);
    if (!feats.length) return setError(t('lib.noFeatures'));
    try {
      const run = await startTraining({
        datasetId: dataset.id, target, features: feats, task: inferred, pluginId, params, seed, validFraction, preprocess: DEFAULT_PREPROCESS,
      });
      setTaskId(run.handle.id);
      setExpId(null);
      const e = await run.done;
      setExpId(e.id);
    } catch (e) {
      if ((e as Error).name !== 'CancelledError') setError((e as Error).message);
    }
  };

  return (
    <div className="module">
      <h1>{t('nav.library')}</h1>
      <div className="two-col">
        <div className="card form">
          <div className="field">
            <label>{t('exp.dataset')}</label>
            <select value={dataset.id} onChange={(e) => useUi.getState().selectDataset(e.currentTarget.value)}>
              {project.datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="target">{t('lib.target')}</label>
            <select id="target" data-testid="target" value={target} onChange={(e) => changeTarget(e.currentTarget.value)}>
              {dataset.columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            {<div className="hint">{t('lib.taskKind')}: <strong>{t(`task.kind.${inferred}` as MessageKey)}</strong></div>}
          </div>
          <details className="field">
            <summary>{t('lib.features')} ({features.filter((f) => f !== target).length}/{dataset.columns.length - 1})</summary>
            <div className="row small">
              <button className="link" onClick={() => setFeatures(dataset.columns.map((c) => c.name).filter((n) => n !== target))}>{t('lib.featuresAll')}</button>
              <button className="link" onClick={() => setFeatures([])}>{t('lib.featuresNone')}</button>
            </div>
            <div className="checks">
              {dataset.columns.filter((c) => c.name !== target).map((c) => (
                <label key={c.name} className="check">
                  <input type="checkbox" checked={features.includes(c.name)} onChange={(e) => { const on = e.currentTarget.checked; setFeatures((f) => (on ? [...f, c.name] : f.filter((x) => x !== c.name))); }} />
                  {c.name} <span className={`kind kind-${c.kind}`}>{t(`kind.${c.kind}` as MessageKey)}</span>
                </label>
              ))}
            </div>
          </details>
          <div className="field">
            <label htmlFor="model">{t('lib.model')}</label>
            <select id="model" data-testid="model" value={pluginId} onChange={(e) => { const p = getPlugin(e.currentTarget.value); setPluginId(p.id); setParams(defaultParams(p, inferred)); }}>
              {plugins.map((p) => <option key={p.id} value={p.id}>{t.text(p.name)}{p.engines.length ? ` · ${p.engines.join(', ')}` : ''}</option>)}
            </select>
            <div className="hint">{t.text(plugin.description)}</div>
          </div>
          <div className="row2">
            <div className="field">
              <label htmlFor="valid">{t('lib.valid')}</label>
              <input id="valid" type="number" min={0.05} max={0.5} step={0.05} value={validFraction} onChange={(e) => setValidFraction(Number(e.currentTarget.value))} />
            </div>
            <div className="field">
              <label htmlFor="seed">{t('lib.seed')}</label>
              <input id="seed" type="number" min={0} value={seed} onChange={(e) => setSeed(Number(e.currentTarget.value) >>> 0)} />
            </div>
          </div>
          <div className="row">
            <h3>{t('lib.params')}</h3>
            <div className="spacer" />
            <button className="link" onClick={() => setParams(defaultParams(plugin, inferred))}>{t('lib.reset')}</button>
          </div>
          <ParamForm specs={plugin.params} values={params} onChange={setParams} />
          <div className="row">
            <button className="primary big" onClick={train} disabled={running} data-testid="train">
              {running ? t('lib.training') : t('lib.train')}
            </button>
          </div>
          {error && <div className="error-text">{error}</div>}
        </div>
        <div className="stack">
          <div className="card">
            <h3>{t('lib.curve')}</h3>
            <LiveCurve series={[{ label: plugin.id, points: points ?? [] }]} />
            {task?.engineLoading && <p className="small muted">{t('task.loadingEngine', { name: task.engineLoading.name, pct: Math.round(task.engineLoading.fraction * 100) })}</p>}
          </div>
          {exp && <ExperimentResult exp={exp} />}
        </div>
      </div>
    </div>
  );
}
