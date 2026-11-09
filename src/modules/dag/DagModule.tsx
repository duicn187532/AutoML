import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { downloadBytes, trainGraph } from '@/app/actions';
import { CLASSIFICATION_METRICS, REGRESSION_METRICS, fmtDuration, fmtMetric } from '@/app/format';
import { useProject } from '@/app/stores/project';
import { useTasks } from '@/app/stores/tasks';
import { useUi } from '@/app/stores/ui';
import { EChart, type EChartsOption } from '@/charts/EChart';
import { LiveCurve } from '@/charts/LiveCurve';
import { graphToCode, type CodeTarget } from '@/core/dag/codegen';
import { TEMPLATE_GROUPS, TEMPLATE_INFO } from './templateInfo';
import { NODE_SPECS, analysisOk, analyze, template, type GNode, type Graph, type NodeType, type TemplateId } from '@/core/dag/graph';
import type { DatasetRecord, GraphRecord } from '@/core/project/types';
import { datasetTarget } from '@/core/project/target';
import { NeedData, PageHeader } from '@/app/ui/Page';

/** Head targets for templates: the dataset target first, then (for multi-task templates) the last two other columns. */
const headTargets = (d: DatasetRecord) => {
  const main = datasetTarget(d);
  return [main, ...d.columns.filter((c) => c.name !== main).slice(-2).map((c) => c.name).reverse()];
};
import { safeFileName } from '@/core/security/escape';
import { newId } from '@/core/util/id';
import type { TrainGraphOutput } from '@/core/workers/types';
import { useT, type MessageKey } from '@/i18n';
import { Canvas, NODE_H, NODE_W, fmtParams } from './Canvas';
import { CHART } from '@/charts/palette';

/** M0 / ADR 0002: browser training stays practical up to a few million parameters. */
export const PARAM_LIMIT = 5_000_000;
const PALETTE: NodeType[] = ['input', 'dense', 'dropout', 'batchnorm', 'activation', 'block', 'expert', 'gate', 'merge', 'head'];
const TEMPLATES = Object.keys(TEMPLATE_INFO) as TemplateId[];

/** Approximate encoded input width from the dataset profile (numeric + indicators, one-hot ≤ 30 + other, dates × 4). */
export function estimateDims(d: DatasetRecord, targets: string[]) {
  let inputDim = 0;
  const features: string[] = [];
  for (const c of d.columns) {
    if (targets.includes(c.name) || c.kind === 'id' || c.kind === 'text') continue;
    features.push(c.name);
    if (c.kind === 'numeric') inputDim += c.missing ? 2 : 1;
    else if (c.kind === 'categorical') inputDim += Math.min(c.unique + (c.missing ? 1 : 0), 30) + 1;
    else inputDim += 4;
  }
  const targetDims: Record<string, number> = {};
  for (const c of d.columns) {
    const integerish = c.kind === 'numeric' && c.min !== undefined && Number.isInteger(c.min) && Number.isInteger(c.max ?? 0);
    targetDims[c.name] = c.kind === 'categorical' ? c.unique : integerish && c.unique <= Math.min(20, d.rowCount / 10) ? c.unique : 1;
  }
  return { inputDim, features, targetDims };
}

function Inspector({ node, dataset, onChange }: { node: GNode; dataset?: DatasetRecord; onChange: (n: GNode) => void }) {
  const t = useT();
  const spec = NODE_SPECS[node.type];
  const set = (k: string, v: number | string | boolean) => onChange({ ...node, params: { ...node.params, [k]: v } });
  return (
    <div className="inspector" data-testid="inspector">
      <div className="field"><label>{t('dag.label')}</label><input value={node.label ?? ''} placeholder={t(`dag.node.${node.type}` as MessageKey)} onChange={(e) => onChange({ ...node, label: e.currentTarget.value || undefined })} /></div>
      {Object.entries(node.params).map(([k, v]) => {
        const enums = spec.enums?.[k];
        let input;
        if (node.type === 'head' && k === 'target') input = <select value={String(v)} onChange={(e) => set(k, e.currentTarget.value)} data-testid="head-target"><option value="">—</option>{dataset?.columns.map((c) => <option key={c.name}>{c.name}</option>)}</select>;
        else if (node.type === 'gate' && k === 'ruleFeature') input = <select value={String(v)} onChange={(e) => set(k, e.currentTarget.value)}><option value="">—</option>{dataset?.columns.filter((c) => c.kind === 'numeric').map((c) => <option key={c.name}>{c.name}</option>)}</select>;
        else if (enums) input = <select value={String(v)} onChange={(e) => set(k, e.currentTarget.value)}>{enums.map((o) => {
          // CNN / LSTM / Transformer blocks need image or sequence inputs; tabular graphs cannot use them yet.
          const seqOnly = node.type === 'block' && k === 'kind' && (o === 'cnn' || o === 'lstm' || o === 'transformer');
          return <option key={o} value={o} disabled={seqOnly && v !== o}>{o}{seqOnly ? ` — ${t('dag.seqOnly')}` : ''}</option>;
        })}</select>;
        else if (typeof v === 'boolean') input = <input type="checkbox" checked={v} onChange={(e) => set(k, e.currentTarget.checked)} />;
        else if (typeof v === 'number') input = <input type="number" value={v} step="any" onChange={(e) => set(k, Number(e.currentTarget.value))} />;
        else input = <input value={String(v)} onChange={(e) => set(k, e.currentTarget.value)} />;
        return <div className="field" key={k}><label>{t(`dag.param.${k}` as MessageKey)}</label>{input}</div>;
      })}
      <p className="small muted">{t(`dag.help.${node.type}` as MessageKey)}</p>
    </div>
  );
}

function gateOption(stats: TrainGraphOutput['gates'][string], labels: string[]): EChartsOption {
  return {
    tooltip: { trigger: 'axis' }, legend: { top: 0 },
    grid: { left: 50, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value', max: 1 },
    series: [
      { name: 'share of samples', type: 'bar', data: stats.share.map((x) => +x.toFixed(3)), itemStyle: { color: CHART.primary } },
      { name: 'mean weight', type: 'bar', data: stats.meanWeight.map((x) => +x.toFixed(3)), itemStyle: { color: CHART.primarySoft } },
    ],
  };
}

export function DagModule() {
  const t = useT();
  const project = useProject((s) => s.project)!;
  const upsertGraph = useProject((s) => s.upsertGraph);
  const datasetId = useUi((s) => s.datasetId) ?? project.datasets[0]?.id;
  const dataset = project.datasets.find((d) => d.id === datasetId);
  const stored = (project.graphs ?? [])[0];
  const [rec, setRec] = useState<GraphRecord>(() => stored ?? { id: newId('g'), name: 'Network 1', datasetId, graph: template('mlp', dataset ? [datasetTarget(dataset)] : [], []), updatedAt: Date.now() });
  const graph = rec.graph;
  const [selected, setSelected] = useState<string[]>([]);
  const [undo, setUndo] = useState<Graph[]>([]);
  const [redo, setRedo] = useState<Graph[]>([]);
  const clipboard = useRef<GNode[]>([]);
  const before = useRef<Graph | null>(null);
  const [settings, setSettings] = useState({ epochs: 100, batchSize: 64, learningRate: 0.003, patience: 15, validFraction: 0.2, seed: project.seed });
  const [taskId, setTaskId] = useState<string | null>(null);
  const [result, setResult] = useState<TrainGraphOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<{ target: CodeTarget; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const targets = graph.nodes.filter((n) => n.type === 'head').map((n) => String(n.params.target)).filter(Boolean);
  const targetsKey = targets.join('\u0000');
  const dims = useMemo(() => (dataset ? estimateDims(dataset, targetsKey ? targetsKey.split('\u0000') : []) : { inputDim: 0, features: [], targetDims: {} }), [dataset, targetsKey]);
  const analysis = useMemo(() => analyze(graph, dims), [graph, dims]);
  const ok = analysisOk(analysis);
  const live = useTasks((s) => (taskId ? s.tasks.find((x) => x.id === taskId) : undefined));
  const points = useTasks((s) => (taskId ? s.points[taskId] : undefined));

  const persist = useCallback((g: Graph, templateId?: TemplateId | null) => { const next = { ...rec, graph: g, datasetId, updatedAt: Date.now(), ...(templateId !== undefined ? { templateId: templateId ?? undefined } : {}) }; setRec(next); upsertGraph(next); }, [rec, datasetId, upsertGraph]);
  const commit = useCallback((g: Graph, templateId?: TemplateId | null) => { setUndo((u) => [...u.slice(-50), graph]); setRedo([]); persist(g, templateId); }, [graph, persist]);
  const change = (g: Graph, isCommit: boolean) => {
    if (isCommit) commit(g);
    else { if (!before.current) before.current = graph; setRec((r) => ({ ...r, graph: g })); }
  };
  const moveEnd = () => { if (before.current) { setUndo((u) => [...u.slice(-50), before.current!]); setRedo([]); before.current = null; persist(rec.graph); } };
  const addNode = (type: NodeType) => {
    const id = newId(type[0]);
    const x = 80 + (graph.nodes.length % 6) * 40, y = 60 + (graph.nodes.length % 8) * 30;
    commit({ ...graph, nodes: [...graph.nodes, { id, type, x, y, params: { ...NODE_SPECS[type].defaults, ...(type === 'head' ? { target: dataset ? datasetTarget(dataset) : '' } : {}) } }] });
    setSelected([id]);
  };
  const removeSelected = () => {
    if (!selected.length) return;
    commit({ nodes: graph.nodes.filter((n) => !selected.includes(n.id)), edges: graph.edges.filter((e) => !selected.includes(e.id) && !selected.includes(e.from) && !selected.includes(e.to)), version: 1 });
    setSelected([]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); }
      else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey && undo.length) { e.preventDefault(); setRedo((r) => [...r, graph]); persist(undo[undo.length - 1]); setUndo((u) => u.slice(0, -1)); }
      else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) && redo.length) { e.preventDefault(); setUndo((u) => [...u, graph]); persist(redo[redo.length - 1]); setRedo((r) => r.slice(0, -1)); }
      else if (mod && e.key.toLowerCase() === 'c') clipboard.current = graph.nodes.filter((n) => selected.includes(n.id));
      else if (mod && e.key.toLowerCase() === 'v' && clipboard.current.length) {
        const map = new Map(clipboard.current.map((n) => [n.id, newId(n.type[0])]));
        const nodes = clipboard.current.map((n) => ({ ...n, id: map.get(n.id)!, x: n.x + 40, y: n.y + 40 }));
        const edges = graph.edges.filter((ed) => map.has(ed.from) && map.has(ed.to)).map((ed) => ({ ...ed, id: newId('e'), from: map.get(ed.from)!, to: map.get(ed.to)! }));
        commit({ ...graph, nodes: [...graph.nodes, ...nodes], edges: [...graph.edges, ...edges] });
        setSelected(nodes.map((n) => n.id));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!dataset) return <NeedData id="dag" />;
  const selNode = selected.length === 1 ? graph.nodes.find((n) => n.id === selected[0]) : undefined;
  const headTasks = Object.fromEntries(graph.nodes.filter((n) => n.type === 'head').map((n) => [n.id, (dims.targetDims[String(n.params.target)] ?? 1) > 1 ? 'classification' : 'regression']));
  const headDims = Object.fromEntries(graph.nodes.filter((n) => n.type === 'head').map((n) => [n.id, dims.targetDims[String(n.params.target)] ?? 1]));

  const train = async () => {
    setError(null); setResult(null);
    try {
      setResult(await trainGraph(rec, dataset.id, dims.features, settings, analysis.mode, setTaskId));
    } catch (e) {
      if ((e as Error).name !== 'CancelledError') setError((e as Error).message);
    }
  };

  return (
    <div className="module dag-module">
      <PageHeader id="dag" />
      <div className="card">
        <div className="row">
          <select value={dataset.id} onChange={(e) => useUi.getState().selectDataset(e.currentTarget.value)}>{project.datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <select value="" onChange={(e) => { if (e.currentTarget.value) { const id = e.currentTarget.value as TemplateId; commit(template(id, headTargets(dataset), dims.features), id); setSelected([]); } }} data-testid="dag-template">
            <option value="">{t('dag.templates')}…</option>
            {TEMPLATE_GROUPS.map((g) => (
              <optgroup key={g} label={t(`dag.tplGroup.${g}` as MessageKey)}>
                {TEMPLATES.filter((k) => TEMPLATE_INFO[k].group === g).map((k) => <option key={k} value={k}>{t(`dag.tpl.${k}` as MessageKey)}</option>)}
              </optgroup>
            ))}
          </select>
          <button disabled={!undo.length} onClick={() => { setRedo((r) => [...r, graph]); persist(undo[undo.length - 1]); setUndo((u) => u.slice(0, -1)); }} title="Ctrl+Z">↶</button>
          <button disabled={!redo.length} onClick={() => { setUndo((u) => [...u, graph]); persist(redo[redo.length - 1]); setRedo((r) => r.slice(0, -1)); }} title="Ctrl+Y">↷</button>
          <button disabled={!selected.length} onClick={removeSelected}>{t('exp.delete')}</button>
          <span className="spacer" />
          <button onClick={() => downloadBytes(JSON.stringify(graph, null, 2), `${safeFileName(rec.name)}.graph.json`, 'application/json')}>{t('dag.exportJson')}</button>
          <button onClick={() => fileRef.current?.click()}>{t('dag.importJson')}</button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={async (e) => {
            const f = e.currentTarget.files?.[0]; e.currentTarget.value = '';
            if (!f) return;
            try { const g = JSON.parse(await f.text()) as Graph; if (g.version !== 1 || !Array.isArray(g.nodes)) throw new Error('not a graph file'); commit(g); } catch (err) { alert((err as Error).message); }
          }} />
          {(['keras', 'pytorch', 'tfjs'] as CodeTarget[]).map((ct) => <button key={ct} className="link" onClick={() => setCode({ target: ct, text: graphToCode(graph, ct, { inputDim: dims.inputDim, headDims, headTasks }) })}>{ct === 'tfjs' ? 'TF.js' : ct === 'keras' ? 'Keras' : 'PyTorch'}</button>)}
        </div>
        {rec.templateId && TEMPLATE_INFO[rec.templateId as TemplateId] && (() => {
          const info = TEMPLATE_INFO[rec.templateId as TemplateId];
          return (
            <div className="tpl-ref small" data-testid="dag-template-ref">
              <strong>{t(`dag.tpl.${rec.templateId}` as MessageKey)}</strong> — {t.text(info.note)}
              {info.refs.length > 0 && (
                <ul>{info.refs.map((r) => <li key={r.url}>{t('dag.tplSource')}: <a href={r.url} target="_blank" rel="noopener noreferrer">{r.cite}</a></li>)}</ul>
              )}
            </div>
          );
        })()}
        <div className="palette">
          {PALETTE.map((k) => <button key={k} onClick={() => addNode(k)} data-testid={`add-${k}`}>+ {t(`dag.node.${k}` as MessageKey)}</button>)}
        </div>
      </div>
      <div className="dag-layout">
        <Canvas graph={graph} analysis={analysis} selected={selected} onSelect={setSelected} onChange={change} onMoveEnd={moveEnd} />
        <div className="card dag-side">
          <h3>{t('dag.analysis')}</h3>
          <div className="small">{t('dag.totalParams')}: <strong data-testid="dag-params">{fmtParams(analysis.totalParams)}</strong> · {t('dag.inputDim')}: {dims.inputDim}</div>
          {analysis.totalParams > PARAM_LIMIT && <div className="small error-text">{t('dag.paramWarn', { limit: fmtParams(PARAM_LIMIT) })}</div>}
          <div className="small" data-testid="dag-mode"><span className={`badge ${analysis.mode === 'two-stage' ? 'cancelled' : 'running'}`}>{t(`dag.mode.${analysis.mode}` as MessageKey)}</span> {t(`dag.modeHint.${analysis.mode}` as MessageKey)}</div>
          {(analysis.errors.length > 0 || !ok) && (
            <ul className="small error-text">
              {analysis.errors.map((e) => <li key={e}>{t(`dag.err.${e}` as MessageKey)}</li>)}
              {Object.entries(analysis.info).flatMap(([id, i]) => i.errors.map((e) => <li key={id + e}>{graph.nodes.find((n) => n.id === id)?.label ?? id}: {t(`dag.err.${e}` as MessageKey)}</li>))}
            </ul>
          )}
          {selNode ? <Inspector node={selNode} dataset={dataset} onChange={(n) => commit({ ...graph, nodes: graph.nodes.map((x) => (x.id === n.id ? n : x)) })} /> : <p className="small muted">{t('dag.selectHint')}</p>}
        </div>
      </div>
      <div className="card">
        <div className="row">
          {(['epochs', 'batchSize', 'learningRate', 'patience', 'validFraction', 'seed'] as const).map((k) => (
            <label key={k} className="small field-inline">{t(`dag.set.${k}` as MessageKey)}<input type="number" step="any" value={settings[k]} onChange={(e) => setSettings((s) => ({ ...s, [k]: Number(e.currentTarget.value) }))} /></label>
          ))}
          <button className="primary big" disabled={!ok || live?.status === 'running'} onClick={train} data-testid="dag-train">{live?.status === 'running' ? t('lib.training') : t('lib.train')}</button>
        </div>
        {error && <div className="error-text">{error}</div>}
        {taskId && <LiveCurve series={[{ label: rec.name, points: points ?? [] }]} height={180} />}
      </div>
      {result && (
        <div className="card" data-testid="dag-result">
          <h3>{t('lib.result')} · {t(`dag.mode.${result.mode}` as MessageKey)} · {fmtDuration(result.durationMs)}</h3>
          {result.heads.map((h) => {
            const names = h.task === 'regression' ? REGRESSION_METRICS : CLASSIFICATION_METRICS;
            return (
              <div key={h.node}>
                <h4>→ {h.target}</h4>
                <div className="metrics">{names.map((m) => <div className="metric" key={m}><div className="metric-label">{t(`metric.${m}` as MessageKey)}</div><div className="metric-value">{fmtMetric(m, result.metrics[h.node]?.[m])}</div></div>)}</div>
              </div>
            );
          })}
          {result.experts && (
            <table className="grid"><thead><tr><th>{t('dag.node.expert')}</th><th>model</th>{(result.heads[0].task === 'regression' ? REGRESSION_METRICS : CLASSIFICATION_METRICS).map((m) => <th key={m} className="num">{t(`metric.${m}` as MessageKey)} ({t('dag.alone')})</th>)}</tr></thead>
              <tbody>{result.experts.map((e) => <tr key={e.node}><td>{graph.nodes.find((n) => n.id === e.node)?.label ?? e.node}</td><td>{e.pluginId}</td>{(result.heads[0].task === 'regression' ? REGRESSION_METRICS : CLASSIFICATION_METRICS).map((m) => <td key={m} className="num">{fmtMetric(m, e.metrics[m])}</td>)}</tr>)}</tbody></table>
          )}
          {Object.entries(result.gates).map(([gid, st]) => {
            const labels = graph.edges.filter((e) => e.to === gid && e.port === 'in').map((e) => graph.nodes.find((n) => n.id === e.from)?.label ?? e.from);
            return (
              <div key={gid} className="chart-grid">
                <div><h4>{t('dag.gateViz')}</h4><EChart option={gateOption(st, labels)} height={240} /></div>
                <div>
                  <h4>{t('dag.gateFeatures')}</h4>
                  <table className="grid compact"><tbody>{labels.map((l, i) => <tr key={i}><td>{l}</td><td>{st.topFeatures[i].map((f) => `${f.name} ${f.z >= 0 ? '+' : ''}${f.z.toFixed(2)}σ`).join(', ')}</td></tr>)}</tbody></table>
                </div>
              </div>
            );
          })}
          <p className="small muted">{result.notes.join(' · ')}</p>
        </div>
      )}
      {code && (
        <div className="card">
          <div className="row"><h3>{code.target}</h3><span className="spacer" /><button onClick={() => downloadBytes(code.text, `${safeFileName(rec.name)}.${code.target === 'tfjs' ? 'js' : 'py'}`, 'text/plain')}>{t('dag.download')}</button><button className="link" onClick={() => setCode(null)}>{t('common.close')}</button></div>
          <pre className="model-card">{code.text}</pre>
        </div>
      )}
      <p className="small muted">{t('dag.keys')} · {NODE_W}×{NODE_H}</p>
    </div>
  );
}
