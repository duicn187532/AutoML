import { useEffect, useRef } from 'react';
import uPlot from 'uplot';

export interface CurveSeries {
  label: string;
  points: Record<string, number>[];
}

const PALETTE = ['#2563eb', '#ea580c', '#16a34a', '#9333ea', '#dc2626', '#0891b2', '#ca8a04', '#db2777'];

/**
 * Real-time learning curves (uPlot — cheap to update every epoch).
 * Each series contributes one line per y-key (e.g. loss, val_loss).
 */
export function LiveCurve({ series, x = 'epoch', y = ['loss', 'val_loss'], height = 220, logY = false }: { series: CurveSeries[]; x?: string; y?: string[]; height?: number; logY?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const shape = series.map((s) => s.label).join('|') + '#' + y.join(',') + logY;

  // (re)create when the set of lines changes
  useEffect(() => {
    if (!host.current) return;
    const lines: uPlot.Series[] = [{}];
    series.forEach((s, i) =>
      y.forEach((key, k) =>
        lines.push({
          label: series.length > 1 ? `${s.label} · ${key}` : key,
          stroke: PALETTE[(series.length > 1 ? i : k) % PALETTE.length],
          width: 1.6,
          dash: k > 0 && series.length > 1 ? [5, 4] : undefined,
          spanGaps: true,
        }),
      ),
    );
    const css = getComputedStyle(host.current);
    const axisColor = css.getPropertyValue('--muted').trim() || '#666';
    const gridColor = css.getPropertyValue('--border').trim() || '#ddd';
    const axis = { stroke: axisColor, grid: { stroke: gridColor, width: 1 }, ticks: { stroke: gridColor } };
    const p = new uPlot(
      {
        width: host.current.clientWidth || 400,
        height,
        series: lines,
        scales: { x: { time: false }, y: logY ? { distr: 3 } : {} },
        axes: [{ ...axis, label: x }, axis],
        legend: { live: true },
        cursor: { drag: { x: true, y: false } },
      },
      [[]],
      host.current,
    );
    plot.current = p;
    const ro = new ResizeObserver(() => host.current && p.setSize({ width: host.current.clientWidth, height }));
    ro.observe(host.current);
    return () => {
      ro.disconnect();
      p.destroy();
      plot.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, height]);

  // push data on every update
  useEffect(() => {
    const p = plot.current;
    if (!p) return;
    const xs = [...new Set(series.flatMap((s) => s.points.map((pt) => pt[x])))].sort((a, b) => a - b);
    const data: (number | null)[][] = [xs];
    for (const s of series) {
      const byX = new Map(s.points.map((pt) => [pt[x], pt]));
      for (const key of y) data.push(xs.map((xv) => byX.get(xv)?.[key] ?? null));
    }
    p.setData(data as uPlot.AlignedData);
  }, [series, x, y]);

  return <div ref={host} className="chart" />;
}
