import { useEffect, useRef } from 'react';
import { BarChart, HeatmapChart, LineChart, ParallelChart, ScatterChart } from 'echarts/charts';
import { GridComponent, LegendComponent, ParallelComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { escapeHtml } from '@/core/security/escape';

/**
 * Analysis charts (confusion matrix, ROC, distributions, parallel coordinates later).
 * Tree-shaken ECharts: register only what we use to keep the offline bundle small.
 */
echarts.use([HeatmapChart, LineChart, BarChart, ScatterChart, ParallelChart, GridComponent, ParallelComponent, TooltipComponent, VisualMapComponent, LegendComponent, CanvasRenderer]);

export type EChartsOption = echarts.EChartsCoreOption;

export function EChart({ option, height = 280 }: { option: EChartsOption; height?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const dark = matchMedia?.('(prefers-color-scheme: dark)').matches;
    const chart = echarts.init(host.current, dark ? 'dark' : undefined, { renderer: 'canvas' });
    inst.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(host.current);
    return () => {
      ro.disconnect();
      chart.dispose();
      inst.current = null;
    };
  }, []);

  useEffect(() => {
    inst.current?.setOption({ backgroundColor: 'transparent', ...option }, true);
  }, [option]);

  return <div ref={host} className="chart" style={{ height }} />;
}

export function confusionOption(cm: number[][], labels: string[], axisNames: { truth: string; pred: string }): EChartsOption {
  const data: [number, number, number][] = [];
  let max = 0;
  cm.forEach((row, i) => row.forEach((v, j) => { data.push([j, i, v]); max = Math.max(max, v); }));
  return {
    // ECharts tooltips are HTML: class labels come from user data and MUST be escaped.
    tooltip: { formatter: (p: { value: [number, number, number] }) => `${escapeHtml(axisNames.truth)}: ${escapeHtml(labels[p.value[1]])}<br/>${escapeHtml(axisNames.pred)}: ${escapeHtml(labels[p.value[0]])}<br/>n = ${p.value[2]}` },
    grid: { left: 90, right: 20, top: 10, bottom: 60 },
    xAxis: { type: 'category', data: labels, axisLabel: { interval: 0, rotate: labels.length > 6 ? 30 : 0 }, name: axisNames.pred, nameLocation: 'middle', nameGap: 35, splitArea: { show: true } },
    yAxis: { type: 'category', data: labels, name: axisNames.truth, inverse: true, splitArea: { show: true } },
    visualMap: { min: 0, max: max || 1, show: false, inRange: { color: ['#eef2ff', '#1d4ed8'] } },
    series: [{ type: 'heatmap', data, label: { show: true }, emphasis: { itemStyle: { borderColor: '#111', borderWidth: 1 } } }],
  };
}

export function rocOption(roc: { fpr: number[]; tpr: number[] }, auc: number | undefined): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'value', min: 0, max: 1, name: 'FPR', nameLocation: 'middle', nameGap: 25 },
    yAxis: { type: 'value', min: 0, max: 1, name: 'TPR' },
    series: [
      { type: 'line', name: `ROC (AUC ${auc?.toFixed(3) ?? '—'})`, showSymbol: false, data: roc.fpr.map((f, i) => [f, roc.tpr[i]]), areaStyle: { opacity: 0.08 } },
      { type: 'line', name: 'chance', showSymbol: false, data: [[0, 0], [1, 1]], lineStyle: { type: 'dashed', opacity: 0.5 } },
    ],
    legend: { bottom: 0 },
  };
}

export function importanceOption(names: string[], values: number[]): EChartsOption {
  const top = names.map((n, i) => [n, values[i]] as const).sort((a, b) => b[1] - a[1]).slice(0, 20).reverse();
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 150, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: top.map((x) => x[0]), axisLabel: { interval: 0, width: 140, overflow: 'truncate' } },
    series: [{ type: 'bar', data: top.map((x) => +x[1].toPrecision(4)), itemStyle: { color: '#1d4ed8' } }],
  };
}

export function scatterOption(y: number[], pred: number[]): EChartsOption {
  let lo = Infinity, hi = -Infinity;
  for (const v of [...y, ...pred]) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return {
    tooltip: { trigger: 'item' },
    grid: { left: 70, right: 20, top: 10, bottom: 45 },
    xAxis: { type: 'value', name: 'actual', nameLocation: 'middle', nameGap: 28, min: lo, max: hi, scale: true },
    yAxis: { type: 'value', name: 'predicted', min: lo, max: hi, scale: true },
    series: [
      { type: 'scatter', symbolSize: 4, data: y.map((v, i) => [v, pred[i]]), itemStyle: { color: '#2563eb', opacity: 0.6 } },
      { type: 'line', showSymbol: false, data: [[lo, lo], [hi, hi]], lineStyle: { type: 'dashed', opacity: 0.5 } },
    ],
  };
}

/** Permutation importance; the 95% CI is shown in each bar label. */
export function permutationOption(items: { feature: string; mean: number; ci95: number }[]): EChartsOption {
  const top = items.slice(0, 20).reverse();
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 150, right: 90, top: 10, bottom: 30 },
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: top.map((x) => x.feature), axisLabel: { interval: 0, width: 140, overflow: 'truncate' } },
    series: [{
      type: 'bar',
      data: top.map((x) => ({ value: +x.mean.toPrecision(4), label: { show: true, position: 'right', formatter: `±${x.ci95.toPrecision(2)}`, fontSize: 10 } })),
      itemStyle: { color: '#1d4ed8' },
    }],
  };
}

/** Hyper-parameter influence: one polyline per trial, coloured by the metric. */
export function parallelOption(rows: Record<string, number | string>[], dims: string[], metric: string, higherIsBetter: boolean): EChartsOption {
  const values = rows.map((r) => Number(r[metric])).filter((v) => Number.isFinite(v));
  const isCat = (d: string) => rows.some((r) => typeof r[d] === 'string');
  return {
    parallelAxis: [...dims, metric].map((d, i) => ({
      dim: i, name: d,
      ...(isCat(d) ? { type: 'category', data: [...new Set(rows.map((r) => String(r[d])))] } : {}),
    })),
    parallel: { left: 60, right: 80, top: 40, bottom: 30 },
    visualMap: { dimension: dims.length, min: Math.min(...values), max: Math.max(...values), inRange: { color: higherIsBetter ? ['#cbd5e1', '#1d4ed8'] : ['#1d4ed8', '#cbd5e1'] }, right: 0, top: 'center', calculable: true },
    series: [{ type: 'parallel', lineStyle: { width: 2, opacity: 0.7 }, data: rows.map((r) => [...dims, metric].map((d) => r[d])) }],
  };
}
