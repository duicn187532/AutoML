import { useState } from 'react';
import { downloadBytes, downloadHtmlPredictor, downloadPortableJson, downloadPython, downloadTfjs, experimentCard, predictToCsv } from '@/app/actions';
import { useProject } from '@/app/stores/project';
import type { ExperimentRecord } from '@/core/project/types';
import { safeFileName } from '@/core/security/escape';
import { useT, type MessageKey } from '@/i18n';

/** Batch prediction with an experiment's stored model on any dataset with the same columns. */
export function PredictPanel({ exp }: { exp: ExperimentRecord }) {
  const t = useT();
  const project = useProject((s) => s.project)!;
  const model = project.models.find((m) => m.id === exp.modelId);
  const [datasetId, setDatasetId] = useState(exp.config.datasetId);
  const [idColumn, setIdColumn] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof predictToCsv>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!model) return null;
  const ds = project.datasets.find((d) => d.id === datasetId);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await predictToCsv(model.id, datasetId, idColumn || undefined));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card" data-testid="predict">
      <h3>{t('predict.title')}</h3>
      <div className="row">
        <label className="small">{t('exp.dataset')}{' '}
          <select value={datasetId} onChange={(e) => { setDatasetId(e.currentTarget.value); setResult(null); }}>
            {project.datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="small">{t('predict.idColumn')}{' '}
          <select value={idColumn} onChange={(e) => setIdColumn(e.currentTarget.value)}>
            <option value="">—</option>
            {ds?.columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </label>
        <button className="primary" disabled={busy} onClick={run} data-testid="predict-run">{busy ? '…' : t('predict.run')}</button>
        {result && (
          <button onClick={() => downloadBytes(result.csv, `${safeFileName(`${model.name}-${ds?.name ?? 'data'}`)}-predictions.csv`, 'text/csv;charset=utf-8')} data-testid="predict-download">
            {t('predict.download', { n: result.rows.toLocaleString() })}
          </button>
        )}
      </div>
      <p className="small muted">{t('predict.hint')}</p>
      <div className="row">
        <strong className="small">{t('export.title')}:</strong>
        {(['html', 'json', 'card', 'python', 'tfjs'] as const).filter((k) => (k !== 'python' || !['auto', 'dag'].includes(exp.config.pluginId)) && (k !== 'tfjs' || exp.config.pluginId === 'mlp')).map((k) => (
          <button key={k} className="link" data-testid={`export-${k}`} onClick={async () => {
            setError(null);
            try {
              if (k === 'html') await downloadHtmlPredictor(exp);
              else if (k === 'json') await downloadPortableJson(exp);
              else if (k === 'tfjs') await downloadTfjs(exp);
              else if (k === 'python') downloadPython(exp);
              else downloadBytes(experimentCard(exp), `${safeFileName(exp.name)}-model-card.md`, 'text/markdown');
            } catch (e) { setError((e as Error).message); }
          }}>{t(`export.${k}` as MessageKey)}</button>
        ))}
      </div>
      {error && <div className="error-text">{error}</div>}
      {result && (
        <div className="table-wrap">
          <table className="grid compact">
            <thead><tr>{result.header.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{result.preview.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{String(v)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
