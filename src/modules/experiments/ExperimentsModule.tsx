import { useMemo, useState } from 'react';
import { rerunExperiment } from '@/app/actions';
import { CLASSIFICATION_METRICS, REGRESSION_METRICS, fmtDuration, fmtMetric, fmtTime } from '@/app/format';
import { useProject } from '@/app/stores/project';
import { LiveCurve } from '@/charts/LiveCurve';
import { METRIC_HIGHER_IS_BETTER, type MetricName } from '@/core/ml/metrics';
import { pluginName } from '@/core/models/registry';
import type { ExperimentRecord } from '@/core/project/types';
import { useT, type MessageKey } from '@/i18n';
import { ExperimentResult } from '../library/LibraryModule';
import { PredictPanel } from './PredictPanel';

type SortKey = 'createdAt' | 'name' | 'durationMs' | MetricName;

function sameMetrics(a?: ExperimentRecord, b?: ExperimentRecord): boolean {
  return !!a?.metrics && !!b?.metrics && JSON.stringify(a.metrics.valid) === JSON.stringify(b.metrics.valid);
}

export function ExperimentsModule() {
  const t = useT();
  const project = useProject((s) => s.project)!;
  const removeExperiment = useProject((s) => s.removeExperiment);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'createdAt', dir: -1 });
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<string | null>(null);
  const exps = project.experiments;
  const byId = useMemo(() => new Map(exps.map((e) => [e.id, e])), [exps]);
  const datasetName = (id: string) => project.datasets.find((d) => d.id === id)?.name ?? '—';

  const metricCols: MetricName[] = useMemo(() => {
    const hasReg = exps.some((e) => e.task === 'regression');
    const hasCls = exps.some((e) => e.task && e.task !== 'regression');
    return [...(hasCls ? CLASSIFICATION_METRICS : []), ...(hasReg ? REGRESSION_METRICS : [])];
  }, [exps]);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = exps.filter((e) => !q || [e.name, e.config.pluginId, datasetName(e.config.datasetId), e.config.target, e.status].join(' ').toLowerCase().includes(q));
    const val = (e: ExperimentRecord): number | string => {
      if (sort.key === 'createdAt' || sort.key === 'durationMs') return e[sort.key];
      if (sort.key === 'name') return e.name;
      const v = e.metrics?.valid[sort.key];
      return v === undefined || Number.isNaN(v) ? (METRIC_HIGHER_IS_BETTER[sort.key] ? -Infinity : Infinity) * sort.dir : v;
    };
    return [...list].sort((a, b) => {
      const va = val(a), vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exps, filter, sort, project.datasets]);

  const header = (key: SortKey, label: string, num = false) => (
    <th className={num ? 'num sortable' : 'sortable'} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : key === 'name' ? 1 : -1 }))} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      {label}
      {sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  );

  const compare = selected.map((id) => byId.get(id)).filter((e): e is ExperimentRecord => !!e?.history.epoch?.length);
  const detailExp = detail ? byId.get(detail) : undefined;

  return (
    <div className="module">
      <h1>{t('exp.title')}</h1>
      {exps.length === 0 ? (
        <p className="muted">{t('exp.empty')}</p>
      ) : (
        <>
          <div className="card">
            <div className="row">
              <input className="filter" placeholder={t('exp.filter')} value={filter} onChange={(e) => setFilter(e.currentTarget.value)} />
              <span className="muted small">{rows.length} / {exps.length}</span>
            </div>
            <div className="table-wrap">
              <table className="grid" data-testid="experiments-table">
                <thead>
                  <tr>
                    <th />
                    {header('name', t('exp.name'))}
                    <th>{t('exp.model')}</th>
                    <th>{t('exp.dataset')}</th>
                    <th className="num">{t('exp.seed')}</th>
                    <th>{t('exp.status')}</th>
                    {metricCols.map((m) => header(m, t(`metric.${m}` as MessageKey), true))}
                    {header('durationMs', t('exp.duration'), true)}
                    {header('createdAt', t('exp.created'))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const src = e.rerunOf ? byId.get(e.rerunOf) : undefined;
                    return (
                      <tr key={e.id} className={detail === e.id ? 'selected' : undefined} data-testid="experiment-row">
                        <td>
                          <input type="checkbox" aria-label="select" checked={selected.includes(e.id)} onChange={(ev) => { const on = ev.currentTarget.checked; setSelected((s) => (on ? [...s, e.id] : s.filter((x) => x !== e.id))); }} />
                        </td>
                        <td className="name-cell">
                          <button className="link" onClick={() => setDetail(detail === e.id ? null : e.id)}>{e.name}</button>
                          {src && <br />}
                          {src && <span className={sameMetrics(e, src) ? 'badge done' : 'badge failed'} title={src.name} data-testid="repro-badge">{sameMetrics(e, src) ? '≡' : '≠'} {src.name}</span>}
                        </td>
                        <td>{t.text(pluginName(e.config.pluginId))}</td>
                        <td className="dataset-cell" title={`${datasetName(e.config.datasetId)} → ${e.config.target}`}>{datasetName(e.config.datasetId)} → {e.config.target}</td>
                        <td className="num">{e.config.seed}</td>
                        <td><span className={`badge ${e.status}`} title={e.error}>{t(`task.${e.status}` as MessageKey)}</span></td>
                        {metricCols.map((m) => <td key={m} className="num">{fmtMetric(m, e.metrics?.valid[m])}</td>)}
                        <td className="num">{fmtDuration(e.durationMs)}</td>
                        <td className="small muted">{fmtTime(e.createdAt)}</td>
                        <td className="actions">
                          <button className="link" onClick={() => rerunExperiment(e).catch((err) => alert(err.message))} data-testid="rerun">{t('exp.rerun')}</button>
                          <button className="link danger" onClick={() => removeExperiment(e.id)}>{t('exp.delete')}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {compare.length > 0 && (
            <div className="card">
              <h3>{t('exp.compare')}</h3>
              <LiveCurve
                series={compare.map((e) => ({ label: e.name, points: e.history.epoch.map((ep, i) => ({ epoch: ep, loss: e.history.loss?.[i], val_loss: e.history.val_loss?.[i] })) }))}
              />
            </div>
          )}
          {detailExp?.metrics && <ExperimentResult exp={detailExp} />}
          {detailExp?.modelId && <PredictPanel exp={detailExp} />}
        </>
      )}
    </div>
  );
}
