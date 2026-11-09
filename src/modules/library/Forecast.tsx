import { useState } from 'react';
import { fmtDuration, fmtMetric } from '@/app/format';
import { pool } from '@/app/services';
import { EChart, type EChartsOption } from '@/charts/EChart';
import type { ColumnarTable } from '@/core/data/table';
import type { DatasetRecord } from '@/core/project/types';
import type { ForecastOutput } from '@/core/workers/types';
import { useT } from '@/i18n';

function chart(o: ForecastOutput): EChartsOption {
  const n = o.history.t.length, hold = o.holdout?.pred.length ?? 0;
  const x = [...o.history.t, ...o.futureT];
  const pad = (k: number) => new Array<null>(k).fill(null);
  const band = (lo: number[], hi: number[], start: number, name: string, color: string) => [
    { type: 'line', name: `${name} lo`, data: [...pad(start), ...lo, ...pad(x.length - start - lo.length)], lineStyle: { opacity: 0 }, stack: name, symbol: 'none', tooltip: { show: false } },
    { type: 'line', name: `${name} 95%`, data: [...pad(start), ...hi.map((h, i) => h - lo[i]), ...pad(x.length - start - hi.length)], lineStyle: { opacity: 0 }, areaStyle: { color, opacity: 0.18 }, stack: name, symbol: 'none' },
  ];
  return {
    tooltip: { trigger: 'axis' }, legend: { top: 0, data: ['actual', 'holdout forecast', 'forecast'] },
    grid: { left: 60, right: 20, top: 30, bottom: 50 },
    xAxis: { type: 'category', data: x, axisLabel: { hideOverlap: true } }, yAxis: { type: 'value', scale: true },
    dataZoom: undefined,
    series: [
      { type: 'line', name: 'actual', data: [...o.history.y, ...pad(o.futureT.length)], symbol: 'none', lineStyle: { color: '#1c2330' } },
      ...(o.holdout ? [{ type: 'line', name: 'holdout forecast', data: [...pad(n - hold), ...o.holdout.pred, ...pad(o.futureT.length)], symbol: 'none', lineStyle: { color: '#ea580c', type: 'dashed' } }, ...band(o.holdout.lo, o.holdout.hi, n - hold, 'holdout', '#ea580c')] : []),
      { type: 'line', name: 'forecast', data: [...pad(n), ...o.forecast.pred], symbol: 'none', lineStyle: { color: '#2563eb' } },
      ...band(o.forecast.lo, o.forecast.hi, n, 'forecast', '#2563eb'),
    ],
  };
}

export function Forecast({ dataset, table }: { dataset: DatasetRecord; table: ColumnarTable }) {
  const t = useT();
  const timeCols = dataset.columns.filter((c) => c.kind === 'datetime' || c.kind === 'numeric' || c.kind === 'id');
  const valueCols = dataset.columns.filter((c) => c.kind === 'numeric');
  const [timeColumn, setTime] = useState(dataset.columns.find((c) => c.kind === 'datetime')?.name ?? timeCols[0]?.name ?? '');
  const [valueColumn, setValue] = useState(valueCols.at(-1)?.name ?? '');
  const [method, setMethod] = useState<'arima' | 'ets' | 'lstm' | 'gru' | 'tcn'>('ets');
  const [params, setParams] = useState<Record<string, number | string>>({ p: 1, d: 1, q: 1, trend: 'add', seasonal: 'add' });
  const [horizon, setHorizon] = useState(12);
  const [holdout, setHoldout] = useState(12);
  const [aggregate, setAggregate] = useState<'sum' | 'mean'>('sum');
  const [out, setOut] = useState<ForecastOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setError(null);
    try {
      setOut(await pool.submit({ kind: 'forecast', input: { table, timeColumn, valueColumn, method, params: method === 'arima' ? { p: params.p, d: params.d, q: params.q } : method === 'ets' ? { trend: params.trend, seasonal: params.seasonal } : { units: params.units ?? 32, epochs: params.epochs ?? 60 }, horizon, holdout, aggregate } },
        { label: `${method} · ${valueColumn}`, engines: method === 'arima' || method === 'ets' ? ['pyodide', 'py-sklearn', 'py-stats'] : ['tfjs'] }).result);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="two-col">
      <div className="card form">
        <div className="field"><label>{t('fc.time')}</label><select value={timeColumn} onChange={(e) => setTime(e.currentTarget.value)}>{timeCols.map((c) => <option key={c.name}>{c.name}</option>)}</select></div>
        <div className="field"><label>{t('fc.value')}</label><select value={valueColumn} onChange={(e) => setValue(e.currentTarget.value)}>{valueCols.map((c) => <option key={c.name}>{c.name}</option>)}</select></div>
        <div className="field"><label>{t('fc.aggregate')}</label><select value={aggregate} onChange={(e) => setAggregate(e.currentTarget.value as 'sum' | 'mean')} data-testid="fc-aggregate"><option value="sum">{t('fc.agg.sum')}</option><option value="mean">{t('fc.agg.mean')}</option></select></div>
        <div className="field"><label>{t('unsup.method')}</label><select value={method} onChange={(e) => setMethod(e.currentTarget.value as typeof method)} data-testid="fc-method"><option value="ets">ETS (Holt-Winters)</option><option value="arima">ARIMA</option><option value="lstm">LSTM</option><option value="gru">GRU</option><option value="tcn">TCN</option></select></div>
        {['lstm', 'gru', 'tcn'].includes(method) ? (
          <div className="row2">{(['units', 'epochs'] as const).map((k) => <div className="field" key={k}><label>{k}</label><input type="number" min={1} value={Number(params[k] ?? (k === 'units' ? 32 : 60))} onChange={(e) => setParams((p) => ({ ...p, [k]: Number(e.currentTarget.value) }))} /></div>)}</div>
        ) : method === 'arima' ? (
          <div className="row2">{(['p', 'd', 'q'] as const).map((k) => <div className="field" key={k}><label>{k}</label><input type="number" min={0} max={5} value={Number(params[k])} onChange={(e) => setParams((p) => ({ ...p, [k]: Number(e.currentTarget.value) }))} /></div>)}</div>
        ) : (
          <div className="row2">{(['trend', 'seasonal'] as const).map((k) => <div className="field" key={k}><label>{k}</label><select value={String(params[k])} onChange={(e) => setParams((p) => ({ ...p, [k]: e.currentTarget.value }))}>{['add', 'mul', 'none'].map((o) => <option key={o}>{o}</option>)}</select></div>)}</div>
        )}
        <div className="row2">
          <div className="field"><label>{t('fc.horizon')}</label><input type="number" min={1} value={horizon} onChange={(e) => setHorizon(Number(e.currentTarget.value))} /></div>
          <div className="field"><label>{t('fc.holdout')}</label><input type="number" min={0} value={holdout} onChange={(e) => setHoldout(Number(e.currentTarget.value))} /></div>
        </div>
        <p className="small muted">{t('fc.hint')}</p>
        <button className="primary big" disabled={busy || !timeColumn || !valueColumn} onClick={run} data-testid="fc-run">{busy ? '…' : t('fc.run')}</button>
        {error && <div className="error-text">{error}</div>}
      </div>
      <div className="stack">
        {out && (
          <div className="card" data-testid="fc-result">
            <div className="row"><h3>{t('fc.result')}</h3><span className="small muted">{t('fc.freq', { freq: out.frequency, season: out.season || '—' })} · AIC {Number.isFinite(out.aic) ? out.aic.toFixed(1) : '—'} · {fmtDuration(out.durationMs)}</span></div>
            {!!out.merged && <div className="advice info small">{t('fc.merged', { n: out.merged })}</div>}
            {out.holdout && <div className="metrics">{(['mae', 'rmse', 'mape'] as const).map((m) => <div className="metric" key={m}><div className="metric-label">{m.toUpperCase()} (holdout)</div><div className="metric-value">{fmtMetric(m, out.holdout![m])}</div></div>)}</div>}
            <EChart option={chart(out)} height={360} />
          </div>
        )}
      </div>
    </div>
  );
}
