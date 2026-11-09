import { useEffect, useRef, useState } from 'react';
import type { Analysis, GEdge, GNode, Graph, Port } from '@/core/dag/graph';
import { NODE_SPECS } from '@/core/dag/graph';
import { useT, type MessageKey } from '@/i18n';
import { newId } from '@/core/util/id';

export const NODE_W = 180, NODE_H = 62;
const COLORS: Record<GNode['type'], string> = {
  input: '#4A6C8C', dense: '#C86A2D', dropout: '#A8998B', batchnorm: '#A8998B', activation: '#A8998B', block: '#8A5A7A',
  expert: '#B5473A', gate: '#D9A23F', merge: '#6B7A4F', head: '#3B312A',
};

const portPos = (n: GNode, port: Port | 'out') =>
  port === 'out' ? { x: n.x + NODE_W, y: n.y + NODE_H / 2 } : port === 'ctrl' ? { x: n.x + NODE_W / 2, y: n.y } : { x: n.x, y: n.y + NODE_H / 2 };

function edgePath(a: { x: number; y: number }, b: { x: number; y: number }, ctrl: boolean) {
  const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
  return ctrl ? `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x},${b.y - 60} ${b.x},${b.y}` : `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`;
}

export function fmtParams(n: number) {
  return n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);
}

/**
 * SVG node-graph canvas: drag nodes (multi-select with Shift), drag from an output port to an
 * input / control port to connect, drag the background to pan, click an edge to select it.
 */
export function Canvas({ graph, analysis, selected, onSelect, onChange, onMoveEnd }: {
  graph: Graph; analysis: Analysis; selected: string[];
  onSelect: (ids: string[]) => void; onChange: (g: Graph, commit: boolean) => void; onMoveEnd: () => void;
}) {
  const t = useT();
  const svg = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<null | { kind: 'move'; start: { x: number; y: number }; orig: Record<string, { x: number; y: number }> } | { kind: 'pan'; start: { x: number; y: number }; orig: { x: number; y: number } } | { kind: 'wire'; from: string; to: { x: number; y: number } }>(null);
  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: e.clientX - r.left - pan.x, y: e.clientY - r.top - pan.y };
  };

  const connect = (to: string, port: Port) => {
    if (drag?.kind !== 'wire' || drag.from === to) return;
    if (graph.edges.some((e) => e.from === drag.from && e.to === to && e.port === port)) return;
    const target = graph.nodes.find((n) => n.id === to)!;
    const spec = NODE_SPECS[target.type];
    let edges = graph.edges;
    if (port === 'in' && spec.maxInputs === 1) edges = edges.filter((e) => !(e.to === to && e.port === 'in')); // replace single input
    if (port === 'ctrl') edges = edges.filter((e) => !(e.to === to && e.port === 'ctrl'));
    const e: GEdge = { id: newId('e'), from: drag.from, to, port };
    onChange({ ...graph, edges: [...edges, e] }, true);
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      if (drag.kind === 'pan') setPan({ x: drag.orig.x + e.clientX - drag.start.x, y: drag.orig.y + e.clientY - drag.start.y });
      else if (drag.kind === 'wire') setDrag({ ...drag, to: toLocal(e) });
      else {
        const dx = e.clientX - drag.start.x, dy = e.clientY - drag.start.y;
        onChange({ ...graph, nodes: graph.nodes.map((n) => (drag.orig[n.id] ? { ...n, x: Math.round((drag.orig[n.id].x + dx) / 10) * 10, y: Math.round((drag.orig[n.id].y + dy) / 10) * 10 } : n)) }, false);
      }
    };
    const up = (e: PointerEvent) => {
      if (drag.kind === 'move') onMoveEnd();
      if (drag.kind === 'wire') {
        // Touch pointers stay captured by the element where the drag started, so hit-test the drop point instead of relying on pointerup targets.
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<SVGElement>('[data-port], [data-node]');
        const id = el?.dataset.node;
        if (id) connect(id, (el.dataset.port as Port | undefined) ?? 'in');
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  });

  return (
    <svg
      ref={svg}
      className="dag-canvas"
      data-testid="dag-canvas"
      onPointerDown={(e) => { if (e.target === svg.current) { onSelect([]); setDrag({ kind: 'pan', start: { x: e.clientX, y: e.clientY }, orig: pan }); } }}
    >
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="var(--border)" /></pattern>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" /></marker>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="url(#grid)" pointerEvents="none" />
      <g transform={`translate(${pan.x},${pan.y})`}>
        {graph.edges.map((e) => {
          const a = graph.nodes.find((n) => n.id === e.from), b = graph.nodes.find((n) => n.id === e.to);
          if (!a || !b) return null;
          const sel = selected.includes(e.id);
          return (
            <g key={e.id} className="dag-edge" onPointerDown={(ev) => { ev.stopPropagation(); onSelect([e.id]); }}>
              <path d={edgePath(portPos(a, 'out'), portPos(b, e.port), e.port === 'ctrl')} stroke="transparent" strokeWidth={12} fill="none" />
              <path d={edgePath(portPos(a, 'out'), portPos(b, e.port), e.port === 'ctrl')} stroke={sel ? 'var(--accent)' : e.port === 'ctrl' ? '#D9A23F' : 'var(--muted)'} strokeWidth={sel ? 2.5 : 1.6} strokeDasharray={e.port === 'ctrl' ? '5 4' : undefined} fill="none" markerEnd="url(#arrow)" />
              <text x={(portPos(a, 'out').x + portPos(b, e.port).x) / 2} y={(portPos(a, 'out').y + portPos(b, e.port).y) / 2 - 6} className="dag-shape">{analysis.info[e.from]?.out ?? '?'}</text>
            </g>
          );
        })}
        {drag?.kind === 'wire' && (() => {
          const a = graph.nodes.find((n) => n.id === drag.from)!;
          return <path d={edgePath(portPos(a, 'out'), drag.to, false)} stroke="var(--accent)" strokeWidth={2} fill="none" strokeDasharray="4 3" />;
        })()}
        {graph.nodes.map((n) => {
          const info = analysis.info[n.id];
          const bad = !!info?.errors.length;
          const sel = selected.includes(n.id);
          const spec = NODE_SPECS[n.type];
          const sub = n.type === 'dense' ? `${n.params.units} · ${n.params.activation}` : n.type === 'block' ? `${n.params.kind} ${n.params.units}×${n.params.layers}`
            : n.type === 'expert' ? `${n.params.model}` : n.type === 'gate' ? `${n.params.mode}${n.params.mode === 'topk' ? ` k=${n.params.k}` : ''}` : n.type === 'merge' ? String(n.params.mode)
            : n.type === 'head' ? `→ ${n.params.target || '?'}` : n.type === 'dropout' ? `p=${n.params.rate}` : n.type === 'activation' ? String(n.params.fn) : '';
          return (
            <g key={n.id} transform={`translate(${n.x},${n.y})`} className="dag-node" data-testid={`node-${n.type}`} data-node={n.id}
              onPointerDown={(e) => {
                e.stopPropagation();
                const ids = e.shiftKey ? (sel ? selected.filter((x) => x !== n.id) : [...selected, n.id]) : sel ? selected : [n.id];
                onSelect(ids);
                const orig = Object.fromEntries(graph.nodes.filter((x) => ids.includes(x.id)).map((x) => [x.id, { x: x.x, y: x.y }]));
                setDrag({ kind: 'move', start: { x: e.clientX, y: e.clientY }, orig });
              }}
            >
              <rect width={NODE_W} height={NODE_H} rx={8} fill="var(--panel)" stroke={bad ? 'var(--danger)' : sel ? 'var(--accent)' : 'var(--border)'} strokeWidth={bad || sel ? 2.2 : 1.2} />
              <rect width={6} height={NODE_H} rx={3} fill={COLORS[n.type]} />
              <text x={14} y={19} className="dag-title">{n.label || t(`dag.node.${n.type}` as MessageKey)}</text>
              <text x={14} y={36} className="dag-sub">{sub}</text>
              <text x={14} y={53} className="dag-sub">{info?.out != null ? `out ${info.out}` : 'out ?'}{info?.params ? ` · ${fmtParams(info.params)} params` : ''}</text>
              {bad && <title>{info.errors.map((e) => t(`dag.err.${e}` as MessageKey)).join('\n')}</title>}
              {spec.maxInputs > 0 && <circle cx={0} cy={NODE_H / 2} r={6} className="port in" data-node={n.id} data-port="in" />}
              {spec.hasCtrl && <circle cx={NODE_W / 2} cy={0} r={6} className="port ctrl" data-node={n.id} data-port="ctrl"><title>control</title></circle>}
              {n.type !== 'head' && <circle cx={NODE_W} cy={NODE_H / 2} r={6} className="port out" onPointerDown={(e) => { e.stopPropagation(); setDrag({ kind: 'wire', from: n.id, to: toLocal(e) }); }} />}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
