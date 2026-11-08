import { useEffect, useMemo, useState } from 'react';
import { searchParams, startTraining, trainAll, type SearchMethod } from '@/app/actions';
import type { SearchDim } from '@/core/auto/search';
import { Leaderboard, ParamInfluence } from '../experiments/Leaderboard';
import { CLASSIFICATION_METRICS, REGRESSION_METRICS, fmtDuration, fmtMetric } from '@/app/format';
import { useProject } from '@/app/stores/project';
import { useTasks } from '@/app/stores/tasks';
import { useUi } from '@/app/stores/ui';
import { ParamForm } from '@/app/ui/ParamForm';
import { EChart, confusionOption, importanceOption, permutationOption, rocOption, scatterOption } from '@/charts/EChart';
import { LiveCurve } from '@/charts/LiveCurve';
import type { MetricName } from '@/core/ml/metrics';
import { DEFAULT_PREPROCESS, inferTask, type PreprocessConfig, type TaskKind } from '@/core/ml/preprocess';
import type { SplitKind } from '@/core/ml/split';
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
  const permutation = useMemo(() => (exp.permutation?.length ? permutationOption(exp.permutation) : null), [exp]);
  const importance = useMemo(() => (exp.featureImportance && exp.featureNames ? importanceOption(exp.featureNames, exp.featureImportance) : null), [exp]);
  const residuals = useMemo(() => (exp.task === 'regression' && exp.validPredictions ? scatterOption(exp.validPredictions.y, exp.validPredictions.pred) : null), [exp]);
  return (
    <div className="card" data-testid="result">
      <div className="row">
        <h3>{t('lib.result')} · {exp.name}</h3>
        <span className="muted small">
          n<sub>train</sub>={exp.nTrain} · n<sub>valid</sub>={exp.nValid}{exp.nTest ? <> · n<sub>test</sub>={exp.nTest}</> : null} · {fmtDuration(exp.durationMs)}
          {exp.bestEpoch ? ` · best epoch ${exp.bestEpoch}` : ''}
        </span>
      </div>
      <div className="metrics">
        {names.map((m) => (
          <div className="metric" key={m} data-testid={`metric-${m}`}>
            <div className="metric-label">{t(`metric.${m}` as MessageKey)} · {exp.metrics?.cv ? t('lib.metricCv') : t('lib.metricValid')}</div>
            <div className="metric-value">
              {fmtMetric(m, exp.metrics?.valid[m])}
              {exp.metrics?.cv && <span className="metric-std"> ± {fmtMetric(m, exp.metrics.cv.std[m])}</span>}
            </div>
            <div className="metric-sub muted">
              train {fmtMetric(m, exp.metrics?.train[m])}
              {exp.metrics?.test && <> · <strong>{t('lib.metricTest')} {fmtMetric(m, exp.metrics.test[m])}</strong></>}
            </div>
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
        {residuals && (
          <div>
            <h4>{t('lib.residuals')}</h4>
            <EChart option={residuals} height={300} />
          </div>
        )}
        {permutation && (
          <div>
            <h4>{t('lib.permutation')}</h4>
            <EChart option={permutation} height={Math.min(20, exp.permutation!.length) * 22 + 60} />
          </div>
        )}
        {importance && (
          <div>
            <h4>{t('lib.importance')}</h4>
            <EChart option={importance} height={Math.min(20, exp.featureNames!.length) * 18 + 60} />
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
  const prefill = useUi((s) => (s.libraryPrefill?.datasetId === dataset.id ? s.libraryPrefill : null));
  const initialTarget = prefill?.target ?? dataset.columns[dataset.columns.length - 1]?.name ?? '';

  const [target, setTarget] = useState(initialTarget);
  const [features, setFeatures] = useState<string[]>(() => defaultFeatures(dataset, initialTarget));
  const inferred: TaskKind = useMemo(() => inferTask(getColumn(table, target)), [table, target]);
  const [pluginId, setPluginId] = useState(() => prefill?.pluginId ?? listPlugins(taskOf(initialTarget))[0].id);
  const [params, setParams] = useState<ParamValues>(() => ({ ...defaultParams(getPlugin(pluginId), taskOf(initialTarget)), ...(prefill?.params ?? {}) }));
  useEffect(() => {
    if (prefill) useUi.getState().setLibraryPrefill(null); // consume once
  }, [prefill]);
  const [validFraction, setValidFraction] = useState(0.2);
  const [splitKind, setSplitKind] = useState<SplitKind>('holdout');
  const [testFraction, setTestFraction] = useState(0);
  const [splitColumn, setSplitColumn] = useState(dataset.columns[0]?.name ?? '');
  const [folds, setFolds] = useState(5);
  const [encoding, setEncoding] = useState<NonNullable<PreprocessConfig['categoricalEncoding']>>('onehot');
  const [seed, setSeed] = useState(project.seed);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [expId, setExpId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMethod, setSearchMethod] = useState<SearchMethod>('tpe');
  const [searchTrials, setSearchTrials] = useState(12);
  const [searchKeys, setSearchKeys] = useState<string[]>([]);
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

  const baseConfig = () => {
    const feats = features.filter((f) => f !== target);
    return {
      datasetId: dataset.id, target, features: feats, task: inferred, seed, validFraction,
      split: { kind: splitKind, validFraction, testFraction, column: splitKind === 'time' || splitKind === 'group' ? splitColumn : undefined, folds },
      preprocess: { ...DEFAULT_PREPROCESS, categoricalEncoding: encoding },
    };
  };
  const runAll = async () => {
    setError(null);
    if (!features.filter((f) => f !== target).length) return setError(t('lib.noFeatures'));
    try {
      const { batchId: b, runs } = await trainAll(baseConfig(), inferred);
      setBatchId(b);
      setExpId(null);
      await Promise.allSettled(runs.map((r) => r.done));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const runSearch = async () => {
    setError(null);
    const dims: SearchDim[] = plugin.params.filter((p) => searchKeys.includes(p.key)).map((spec) => ({ key: spec.key, spec }));
    if (!dims.length) return setError(t('search.noDims'));
    try {
      await searchParams({ ...baseConfig(), pluginId, params }, dims, searchMethod, searchTrials, (b) => { setBatchId(b); setExpId(null); });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const train = async () => {
    setError(null);
    if (!target) return setError(t('lib.noTarget'));
    const feats = features.filter((f) => f !== target);
    if (!feats.length) return setError(t('lib.noFeatures'));
    try {
      const run = await startTraining({
        datasetId: dataset.id, target, features: feats, task: inferred, pluginId, params, seed, validFraction,
        split: { kind: splitKind, validFraction, testFraction, column: splitKind === 'time' || splitKind === 'group' ? splitColumn : undefined, folds },
        preprocess: { ...DEFAULT_PREPROCESS, categoricalEncoding: encoding },
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
              {plugins.map((p) => <option key={p.id} value={p.id}>{t.text(p.name)}{p.engines.length ? ` · ${p.engines.includes('pyodide') ? 'Python' : p.engines.join(', ')}` : ''}</option>)}
            </select>
            <div className="hint">{t.text(plugin.description)}</div>
          </div>
          <div className="field">
            <label htmlFor="split">{t('lib.split')}</label>
            <select id="split" value={splitKind} onChange={(e) => setSplitKind(e.currentTarget.value as SplitKind)} data-testid="split">
              {(['holdout', 'kfold', 'time', 'group'] as SplitKind[]).map((k) => <option key={k} value={k}>{t(`split.${k}` as MessageKey)}</option>)}
            </select>
          </div>
          <div className="row2">
            {splitKind === 'kfold' ? (
              <div className="field">
                <label htmlFor="folds">{t('lib.folds')}</label>
                <input id="folds" type="number" min={2} max={20} value={folds} onChange={(e) => setFolds(Number(e.currentTarget.value))} />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="valid">{t('lib.valid')}</label>
                <input id="valid" type="number" min={0.05} max={0.5} step={0.05} value={validFraction} onChange={(e) => setValidFraction(Number(e.currentTarget.value))} />
              </div>
            )}
            <div className="field">
              <label htmlFor="test">{t('lib.test')}</label>
              <input id="test" type="number" min={0} max={0.4} step={0.05} value={testFraction} onChange={(e) => setTestFraction(Number(e.currentTarget.value))} />
            </div>
          </div>
          {(splitKind === 'time' || splitKind === 'group') && (
            <div className="field">
              <label htmlFor="splitcol">{t('lib.splitColumn')}</label>
              <select id="splitcol" value={splitColumn} onChange={(e) => setSplitColumn(e.currentTarget.value)}>
                {dataset.columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="row2">
            <div className="field">
              <label htmlFor="enc">{t('lib.encoding')}</label>
              <select id="enc" value={encoding} onChange={(e) => setEncoding(e.currentTarget.value as typeof encoding)}>
                {(['onehot', 'ordinal', 'target', 'hash'] as const).map((k) => <option key={k} value={k}>{t(`enc.${k}` as MessageKey)}</option>)}
              </select>
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
            <button onClick={runAll} data-testid="train-all" title={t('lib.trainAllHint')}>{t('lib.trainAll')}</button>
            <button className="link" onClick={() => setSearchOpen((v) => !v)}>{t('search.title')} {searchOpen ? '▴' : '▾'}</button>
          </div>
          {searchOpen && (
            <div className="card inset">
              <div className="row2">
                <div className="field">
                  <label>{t('search.method')}</label>
                  <select value={searchMethod} onChange={(e) => setSearchMethod(e.currentTarget.value as SearchMethod)}>
                    {(['tpe', 'random', 'grid'] as SearchMethod[]).map((m) => <option key={m} value={m}>{t(`search.${m}` as MessageKey)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>{t('search.trials')}</label>
                  <input type="number" min={2} max={200} value={searchTrials} onChange={(e) => setSearchTrials(Number(e.currentTarget.value))} />
                </div>
              </div>
              <div className="checks">
                {plugin.params.filter((p) => p.type !== 'bool').map((p) => (
                  <label key={p.key} className="check">
                    <input type="checkbox" checked={searchKeys.includes(p.key)} onChange={(e) => { const on = e.currentTarget.checked; setSearchKeys((k) => (on ? [...k, p.key] : k.filter((x) => x !== p.key))); }} />
                    {t.text(p.label)} <span className="small muted">{p.type === 'enum' ? p.options.map((o) => o.value).join(' / ') : `${p.recommended?.[0] ?? p.min} – ${p.recommended?.[1] ?? p.max}${p.log ? ' (log)' : ''}`}</span>
                  </label>
                ))}
              </div>
              <button onClick={runSearch} data-testid="search-run">{t('search.run')}</button>
            </div>
          )}
          {error && <div className="error-text">{error}</div>}
        </div>
        <div className="stack">
          <div className="card">
            <h3>{t('lib.curve')}</h3>
            <LiveCurve series={[{ label: plugin.id, points: points ?? [] }]} />
            {task?.engineLoading && <p className="small muted">{t('task.loadingEngine', { name: task.engineLoading.name, pct: Math.round(task.engineLoading.fraction * 100) })}</p>}
          </div>
          {batchId && <Leaderboard batchId={batchId} onSelect={(e) => setExpId(e.id)} />}
          {batchId && <ParamInfluence batchId={batchId} />}
          {exp && <ExperimentResult exp={exp} />}
        </div>
      </div>
    </div>
  );
}
