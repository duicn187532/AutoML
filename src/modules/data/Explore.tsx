import { useMemo, useState } from 'react';
import { EChart, type EChartsOption } from '@/charts/EChart';
import type { DataProfile } from '@/core/data/explore';
import { useT, type MessageKey } from '@/i18n';
import { fmtNum } from '@/app/format';
import { CHART } from '@/charts/palette';

function histOption(profile: DataProfile, col: string): EChartsOption {
  const h = profile.histograms[col];
  if (!h) return {};
  const labels = h.kind === 'numeric' ? h.counts.map((_, i) => fmtNum(h.labels[i] as number, 2)) : (h.labels as string[]);
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 16, top: 16, bottom: 60 },
    xAxis: { type: 'category', data: labels, axisLabel: { rotate: 40, hideOverlap: true } },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: h.counts, barCategoryGap: h.kind === 'numeric' ? '2%' : '20%', itemStyle: { color: CHART.primary } }],
  };
}

function corrOption(profile: DataProfile): EChartsOption {
  const { columns, matrix } = profile.correlation;
  const data: [number, number, number][] = [];
  matrix.forEach((row, i) => row.forEach((v, j) => data.push([j, i, +v.toFixed(3)])));
  return {
    tooltip: { position: 'top' },
    grid: { left: 110, right: 70, top: 10, bottom: 100 },
    xAxis: { type: 'category', data: columns, axisLabel: { rotate: 45, interval: 0 } },
    yAxis: { type: 'category', data: columns, inverse: true, axisLabel: { interval: 0 } },
    visualMap: { min: -1, max: 1, calculable: true, orient: 'vertical', right: 0, top: 'center', inRange: { color: [...CHART.diverging] } },
    series: [{ type: 'heatmap', data, label: { show: columns.length <= 12, fontSize: 10 } }],
  };
}

function relationOption(profile: DataProfile): EChartsOption {
  const rel = (profile.target?.relations ?? []).slice(0, 25).reverse();
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0 },
    grid: { left: 130, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'value', min: 0, max: 1 },
    yAxis: { type: 'category', data: rel.map((r) => r.feature), axisLabel: { interval: 0 } },
    series: [
      { name: 'predictive score', type: 'bar', data: rel.map((r) => +r.score.toFixed(3)), itemStyle: { color: CHART.primary } },
      { name: '|r| / η / V', type: 'bar', data: rel.map((r) => +r.assoc.toFixed(3)), itemStyle: { color: CHART.primarySoft } },
    ],
  };
}

export function Explore({ profile }: { profile: DataProfile }) {
  const t = useT();
  const names = profile.columns.map((c) => c.name);
  const [col, setCol] = useState(names[0]);
  const hist = useMemo(() => histOption(profile, col), [profile, col]);
  const corr = useMemo(() => corrOption(profile), [profile]);
  const rel = useMemo(() => relationOption(profile), [profile]);
  const p = profile.columns.find((c) => c.name === col);
  return (
    <>
      <div className="card">
        <div className="row">
          <h3>{t('explore.distribution')}</h3>
          <select value={col} onChange={(e) => setCol(e.currentTarget.value)}>
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {p && <span className="small muted">{t(`kind.${p.kind}` as MessageKey)} · {t('data.col.missing')} {p.missing}</span>}
        </div>
        <EChart option={hist} height={260} />
      </div>
      {profile.target && (
        <div className="card">
          <h3>{t('explore.target', { col: profile.target.column })}</h3>
          <p className="small muted">{t('explore.targetHint')}</p>
          <EChart option={rel} height={Math.max(220, 22 * Math.min(25, profile.target.relations.length) + 60)} />
        </div>
      )}
      {profile.correlation.columns.length > 1 && (
        <div className="card">
          <h3>{t('explore.correlation')}</h3>
          <EChart option={corr} height={Math.max(300, 26 * profile.correlation.columns.length + 120)} />
        </div>
      )}
    </>
  );
}
