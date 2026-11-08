import { useMemo, useState } from 'react';
import { EChart, type EChartsOption } from '@/charts/EChart';
import type { ExperimentRecord } from '@/core/project/types';
import { useT } from '@/i18n';

/** Binary classification: decision-threshold slider (confusion / precision / recall / F1) + calibration curve. */
export function ThresholdPanel({ exp }: { exp: ExperimentRecord }) {
  const t = useT();
  const vp = exp.validPredictions;
  const [thr, setThr] = useState(0.5);
  const p1 = useMemo(() => vp?.proba?.map((r) => r[1]) ?? [], [vp]);
  const y = useMemo(() => vp?.y ?? [], [vp]);
  const calib = useMemo<EChartsOption>(() => {
    const bins = 10, cnt = new Array(bins).fill(0), sumP = new Array(bins).fill(0), sumY = new Array(bins).fill(0);
    p1.forEach((p, i) => { const b = Math.min(bins - 1, Math.floor(p * bins)); cnt[b]++; sumP[b] += p; sumY[b] += y[i]; });
    const pts = cnt.map((c, b) => (c ? [sumP[b] / c, sumY[b] / c, c] : null)).filter(Boolean) as number[][];
    const brier = p1.reduce((a, p, i) => a + (p - y[i]) ** 2, 0) / (p1.length || 1);
    return {
      title: { text: `Brier ${brier.toFixed(4)}`, textStyle: { fontSize: 12, fontWeight: 'normal' }, right: 10, top: 0 },
      tooltip: { trigger: 'item' },
      grid: { left: 50, right: 20, top: 30, bottom: 40 },
      xAxis: { type: 'value', min: 0, max: 1, name: 'predicted', nameLocation: 'middle', nameGap: 25 },
      yAxis: { type: 'value', min: 0, max: 1, name: 'observed' },
      series: [
        { type: 'line', data: pts.map((p) => [p[0], p[1]]), symbolSize: (_v: unknown, params: { dataIndex: number }) => 4 + Math.sqrt(pts[params.dataIndex][2]), itemStyle: { color: '#2563eb' } },
        { type: 'line', data: [[0, 0], [1, 1]], showSymbol: false, lineStyle: { type: 'dashed', opacity: 0.5 } },
      ],
    };
  }, [p1, y]);
  if (!vp?.proba || exp.task !== 'binary' || !exp.classes) return null;
  let tp = 0, fp = 0, tn = 0, fn = 0;
  p1.forEach((p, i) => { const pred = p >= thr ? 1 : 0; if (pred && y[i]) tp++; else if (pred) fp++; else if (y[i]) fn++; else tn++; });
  const precision = tp + fp ? tp / (tp + fp) : 0, recall = tp + fn ? tp / (tp + fn) : 0, f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const [neg, pos] = exp.classes;
  return (
    <div className="chart-grid" data-testid="threshold">
      <div>
        <h4>{t('thr.title', { pos })}</h4>
        <input type="range" min={0.01} max={0.99} step={0.01} value={thr} onChange={(e) => setThr(Number(e.currentTarget.value))} style={{ width: '100%' }} aria-label="threshold" />
        <div className="small">{t('thr.value')}: <strong>{thr.toFixed(2)}</strong> · precision {(precision * 100).toFixed(1)}% · recall {(recall * 100).toFixed(1)}% · F1 {f1.toFixed(3)} · accuracy {(((tp + tn) / (p1.length || 1)) * 100).toFixed(1)}%</div>
        <table className="grid compact" style={{ width: 'auto', marginTop: 8 }}>
          <thead><tr><th /><th>pred {neg}</th><th>pred {pos}</th></tr></thead>
          <tbody><tr><th>{neg}</th><td className="num">{tn}</td><td className="num">{fp}</td></tr><tr><th>{pos}</th><td className="num">{fn}</td><td className="num">{tp}</td></tr></tbody>
        </table>
      </div>
      <div>
        <h4>{t('thr.calibration')}</h4>
        <EChart option={calib} height={240} />
      </div>
    </div>
  );
}
