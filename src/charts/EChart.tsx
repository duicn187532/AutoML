import { useEffect, useRef } from 'react';
import { BarChart, HeatmapChart, LineChart, ScatterChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { escapeHtml } from '@/core/security/escape';

/**
 * Analysis charts (confusion matrix, ROC, distributions, parallel coordinates later).
 * Tree-shaken ECharts: register only what we use to keep the offline bundle small.
 */
echarts.use([HeatmapChart, LineChart, BarChart, ScatterChart, GridComponent, TooltipComponent, VisualMapComponent, LegendComponent, CanvasRenderer]);

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
