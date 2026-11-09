import { unsupervisedAdvice } from '@/core/models/advice';
import { useState } from 'react';
import { fmtDuration, fmtNum } from '@/app/format';
import { pool } from '@/app/services';
import { useProject } from '@/app/stores/project';
import { useUi } from '@/app/stores/ui';
import { EChart, type EChartsOption } from '@/charts/EChart';
import type { Column, ColumnarTable } from '@/core/data/table';
import type { DatasetRecord } from '@/core/project/types';
import type { UnsupervisedMethod, UnsupervisedOutput } from '@/core/workers/types';
import { useT, type MessageKey } from '@/i18n';

const METHODS: { id: UnsupervisedMethod; group: 'cluster' | 'reduce' | 'anomaly'; params: Record<string, number | string> }[] = [
  { id: 'kmeans', group: 'cluster', params: { k: 3 } },
  { id: 'gmm', group: 'cluster', params: { k: 3, covariance: 'full' } },
  { id: 'agglomerative', group: 'cluster', params: { k: 3, linkage: 'ward' } },
  { id: 'dbscan', group: 'cluster', params: { eps: 1.5, minSamples: 5 } },
  { id: 'pca', group: 'reduce', params: { components: 2 } },
  { id: 'tsne', group: 'reduce', params: { perplexity: 30 } },
  { id: 'isolation_forest', group: 'anomaly', params: { contamination: 0.05, trees: 200 } },
  { id: 'lof', group: 'anomaly', params: { contamination: 0.05, neighbors: 20 } },
  { id: 'autoencoder', group: 'anomaly', params: { contamination: 0.05, hidden: 32, epochs: 80 } },
];
const PALETTE = ['#2563eb', '#ea580c', '#16a34a', '#9333ea', '#dc2626', '#0891b2', '#ca8a04', '#db2777', '#64748b', '#0d9488'];

function scatter(o: UnsupervisedOutput, colorBy?: number[]): EChartsOption {
  const pts = Array.from({ length: o.embedding.length / 2 }, (_, i) => [o.embedding[2 * i], o.embedding[2 * i + 1]]);
  const groups = colorBy ?? o.labels ?? o.anomaly;
  if (!groups) return { grid: { left: 40, right: 20, top: 20, bottom: 30 }, xAxis: { scale: true }, yAxis: { scale: true }, series: [{ type: 'scatter', symbolSize: 4, data: pts }] };
  const keys = [...new Set(groups)].sort((a, b) => a - b);
  return {
    tooltip: { trigger: 'item' }, legend: { top: 0 },
    grid: { left: 40, right: 20, top: 30, bottom: 30 }, xAxis: { scale: true, name: 'dim 1' }, yAxis: { scale: true, name: 'dim 2' },
    series: keys.map((k, i) => ({
      type: 'scatter', symbolSize: 5, name: o.anomaly ? (k ? 'anomaly' : 'normal') : k < 0 ? 'noise' : `cluster ${k}`,
      itemStyle: { color: o.anomaly ? (k ? '#dc2626' : '#94a3b8') : k < 0 ? '#94a3b8' : PALETTE[i % PALETTE.length], opacity: 0.75 },
      data: pts.filter((_, r) => groups[r] === k),
    })),
  };
}

export function Unsupervised({ dataset, table }: { dataset: DatasetRecord; table: ColumnarTable }) {
  const t = useT();
  const addDataset = useProject((s) => s.addDataset);
  const seed = useProject((s) => s.project!.seed);
  const [method, setMethod] = useState<UnsupervisedMethod>('kmeans');
  const [params, setParams] = useState<Record<string, number | string>>(METHODS[0].params);
  const [features, setFeatures] = useState(() => dataset.columns.filter((c) => c.kind === 'numeric' || c.kind === 'categorical').map((c) => c.name));
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<UnsupervisedOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setError(null);
    try {
      setOut(await pool.submit({ kind: 'unsupervised', input: { table, features, method, params, seed } }, { label: `${method} · ${dataset.name}`, engines: method === 'autoencoder' ? ['tfjs'] : ['pyodide', 'py-sklearn'] }).result);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const saveColumns = async () => {
    if (!out) return;
    const extra: Column[] = [];
    if (out.labels) extra.push({ name: `${method}_cluster`, kind: 'categorical', values: out.labels.map((l) => (l < 0 ? 'noise' : String(l))) });
    if (out.scores) extra.push({ name: `${method}_score`, kind: 'numeric', values: Float64Array.from(out.scores) }, { name: `${method}_anomaly`, kind: 'categorical', values: out.anomaly!.map(String) });
    if (out.components) out.components[0].forEach((_, j) => extra.push({ name: `${method}_${j + 1}`, kind: 'numeric', values: Float64Array.from(out.components!, (r) => r[j]) }));
    const d = await addDataset({ rowCount: table.rowCount, columns: [...table.columns.filter((c) => !extra.some((e) => e.name === c.name)), ...extra] }, { name: `${dataset.name} + ${method}`, source: { type: 'derived' } });
    useUi.getState().selectDataset(d.id);
  };
  const spec = METHODS.find((m) => m.id === method)!;
  return (
    <div className="two-col">
      <div className="card form">
        <div className="field">
          <label>{t('unsup.method')}</label>
          <select value={method} onChange={(e) => { const m = METHODS.find((x) => x.id === e.currentTarget.value)!; setMethod(m.id); setParams(m.params); setOut(null); }} data-testid="unsup-method">
            {(['cluster', 'reduce', 'anomaly'] as const).map((g) => (
              <optgroup key={g} label={t(`unsup.group.${g}` as MessageKey)}>
                {METHODS.filter((m) => m.group === g).map((m) => <option key={m.id} value={m.id}>{t(`unsup.m.${m.id}` as MessageKey)}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        {Object.entries(params).map(([k, v]) => (
          <div className="field" key={k}>
            <label>{k}</label>
            {typeof v === 'number' ? <input type="number" step="any" value={v} onChange={(e) => setParams((p) => ({ ...p, [k]: Number(e.currentTarget.value) }))} />
              : <select value={v} onChange={(e) => setParams((p) => ({ ...p, [k]: e.currentTarget.value }))}>{(k === 'linkage' ? ['ward', 'complete', 'average', 'single'] : ['full', 'tied', 'diag', 'spherical']).map((o) => <option key={o}>{o}</option>)}</select>}
          </div>
        ))}
        <details className="field">
          <summary>{t('lib.features')} ({features.length})</summary>
          <div className="checks">{dataset.columns.filter((c) => c.kind !== 'text').map((c) => (
            <label key={c.name} className="check"><input type="checkbox" checked={features.includes(c.name)} onChange={(e) => { const on = e.currentTarget.checked; setFeatures((f) => (on ? [...f, c.name] : f.filter((x) => x !== c.name))); }} />{c.name}</label>
          ))}</div>
        </details>
        <p className="small muted">{t(`unsup.hint.${spec.group}` as MessageKey)}</p>
        {unsupervisedAdvice(method, dataset.rowCount).map((a, i) => <div key={i} className={`advice ${a.level}`}>{a.level === 'warn' ? '⚠ ' : 'ℹ '}{t.text(a.text)}</div>)}
        <button className="primary big" disabled={busy || !features.length} onClick={run} data-testid="unsup-run">{busy ? '…' : t('unsup.run')}</button>
        {error && <div className="error-text">{error}</div>}
      </div>
      <div className="stack">
        {out && (
          <div className="card" data-testid="unsup-result">
            <div className="row">
              <h3>{t(`unsup.m.${out.method}` as MessageKey)}</h3>
              <span className="small muted">{fmtDuration(out.durationMs)}</span>
              <span className="spacer" />
              <button onClick={saveColumns}>{t('unsup.save')}</button>
            </div>
            <div className="metrics">
              {out.nClusters !== undefined && <div className="metric"><div className="metric-label">{t('unsup.clusters')}</div><div className="metric-value">{out.nClusters}</div>{out.noise ? <div className="metric-sub muted">noise {out.noise}</div> : null}</div>}
              {out.silhouette !== undefined && <div className="metric"><div className="metric-label">{t('unsup.silhouette')}</div><div className="metric-value">{out.silhouette.toFixed(3)}</div></div>}
              {out.explainedVariance && <div className="metric"><div className="metric-label">{t('unsup.variance')}</div><div className="metric-value">{(out.explainedVariance.reduce((a, b) => a + b, 0) * 100).toFixed(1)}%</div><div className="metric-sub muted">{out.explainedVariance.map((v) => `${(v * 100).toFixed(1)}%`).join(' · ')}</div></div>}
              {out.anomaly && <div className="metric"><div className="metric-label">{t('unsup.anomalies')}</div><div className="metric-value">{out.anomaly.filter(Boolean).length}</div></div>}
              {out.inertia !== undefined && <div className="metric"><div className="metric-label">inertia</div><div className="metric-value">{fmtNum(out.inertia, 1)}</div></div>}
              {out.bic !== undefined && <div className="metric"><div className="metric-label">BIC</div><div className="metric-value">{fmtNum(out.bic, 1)}</div></div>}
            </div>
            <EChart option={scatter(out)} height={380} />
            <p className="small muted">{t('unsup.projection')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
