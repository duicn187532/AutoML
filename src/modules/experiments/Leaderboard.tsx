import { CLASSIFICATION_METRICS, REGRESSION_METRICS, fmtBytes, fmtDuration, fmtMetric } from '@/app/format';
import { useProject } from '@/app/stores/project';
import { METRIC_HIGHER_IS_BETTER, type MetricName } from '@/core/ml/metrics';
import type { TaskKind } from '@/core/ml/preprocess';
import { pluginName } from '@/core/models/registry';
import type { ExperimentRecord } from '@/core/project/types';
import { useT, type MessageKey } from '@/i18n';
import { EChart, parallelOption } from '@/charts/EChart';

export const PRIMARY_METRIC: Record<TaskKind, MetricName> = { binary: 'auc', multiclass: 'accuracy', regression: 'rmse' };

export function rankExperiments(exps: ExperimentRecord[], metric: MetricName): ExperimentRecord[] {
  const hi = METRIC_HIGHER_IS_BETTER[metric];
  const v = (e: ExperimentRecord) => e.metrics?.valid[metric] ?? NaN;
  return [...exps].sort((a, b) => {
    const x = v(a), y = v(b);
    if (Number.isNaN(x)) return 1;
    if (Number.isNaN(y)) return -1;
    return hi ? y - x : x - y;
  });
}

/** Ranked comparison of the experiments of one "train all" batch. */
export function Leaderboard({ batchId, onSelect }: { batchId: string; onSelect?: (e: ExperimentRecord) => void }) {
  const t = useT();
  const project = useProject((s) => s.project)!;
  const exps = project.experiments.filter((e) => e.batchId === batchId);
  if (!exps.length) return null;
  const task = exps.find((e) => e.task)?.task ?? 'binary';
  const primary = PRIMARY_METRIC[task];
  const cols = task === 'regression' ? REGRESSION_METRICS : CLASSIFICATION_METRICS;
  const sizeOf = (e: ExperimentRecord) => project.models.find((m) => m.id === e.modelId)?.sizeBytes;
  const cv = exps.some((e) => e.metrics?.cv);
  return (
    <div className="card" data-testid="leaderboard">
      <h3>Leaderboard · {t(`metric.${primary}` as MessageKey)} {cv ? `(${t('lib.metricCv')})` : `(${t('lib.metricValid')})`}</h3>
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('exp.model')}</th>
              {cols.map((m) => <th key={m} className="num">{t(`metric.${m}` as MessageKey)}</th>)}
              <th className="num">{t('exp.duration')}</th>
              <th className="num">size</th>
              <th>{t('exp.status')}</th>
            </tr>
          </thead>
          <tbody>
            {rankExperiments(exps, primary).map((e, i) => (
              <tr key={e.id} className={i === 0 && e.status === 'done' ? 'selected' : undefined}>
                <td>{e.status === 'done' ? i + 1 : ''}</td>
                <td><button className="link" onClick={() => onSelect?.(e)}>{t.text(pluginName(e.config.pluginId))}</button></td>
                {cols.map((m) => (
                  <td key={m} className="num">
                    {fmtMetric(m, e.metrics?.valid[m])}
                    {e.metrics?.cv && <span className="muted small"> ±{fmtMetric(m, e.metrics.cv.std[m])}</span>}
                  </td>
                ))}
                <td className="num">{fmtDuration(e.durationMs)}</td>
                <td className="num">{sizeOf(e) ? fmtBytes(sizeOf(e)!) : '—'}</td>
                <td><span className={`badge ${e.status}`} title={e.error}>{t(`task.${e.status}` as MessageKey)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Parallel-coordinates view of how varied parameters relate to the primary metric. */
export function ParamInfluence({ batchId }: { batchId: string }) {
  const t = useT();
  const project = useProject((s) => s.project)!;
  const exps = project.experiments.filter((e) => e.batchId === batchId && e.status === 'done' && e.metrics);
  const pluginIds = new Set(exps.map((e) => e.config.pluginId));
  if (exps.length < 3 || pluginIds.size !== 1) return null;
  const task = exps[0].task ?? 'binary';
  const metric = PRIMARY_METRIC[task];
  const keys = Object.keys(exps[0].config.params).filter((k) => new Set(exps.map((e) => JSON.stringify(e.config.params[k]))).size > 1);
  if (!keys.length) return null;
  const rows = exps.map((e) => ({ ...Object.fromEntries(keys.map((k) => [k, e.config.params[k] as number | string])), [metric]: e.metrics!.valid[metric] ?? NaN }));
  return (
    <div className="card">
      <h3>{t('search.influence')}</h3>
      <EChart option={parallelOption(rows, keys, metric, METRIC_HIGHER_IS_BETTER[metric])} height={300} />
    </div>
  );
}
