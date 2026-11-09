/**
 * Architecture graph (DAG) for the network designer (M5).
 * Tabular input; layers, blocks, gates (soft / top-k MoE / rule routing), experts, merges and
 * one or more heads (multi-task). Shapes are vectors (feature dimension only) for tabular graphs.
 */
export type NodeType = 'input' | 'dense' | 'dropout' | 'batchnorm' | 'activation' | 'block' | 'expert' | 'gate' | 'merge' | 'head';
export type Port = 'in' | 'ctrl';
export type Params = Record<string, number | string | boolean>;

export interface GNode { id: string; type: NodeType; x: number; y: number; params: Params; label?: string }
export interface GEdge { id: string; from: string; to: string; port: Port }
export interface Graph { version: 1; nodes: GNode[]; edges: GEdge[] }

export interface NodeSpec {
  type: NodeType;
  /** default params */
  defaults: Params;
  /** allowed enum values */
  enums?: Record<string, string[]>;
  maxInputs: number;
  hasCtrl?: boolean;
}

export const NODE_SPECS: Record<NodeType, NodeSpec> = {
  input: { type: 'input', defaults: {}, maxInputs: 0 },
  dense: { type: 'dense', defaults: { units: 64, activation: 'relu', l2: 0 }, enums: { activation: ['relu', 'elu', 'selu', 'tanh', 'sigmoid', 'linear', 'gelu'] }, maxInputs: 1 },
  dropout: { type: 'dropout', defaults: { rate: 0.2 }, maxInputs: 1 },
  batchnorm: { type: 'batchnorm', defaults: {}, maxInputs: 1 },
  activation: { type: 'activation', defaults: { fn: 'relu' }, enums: { fn: ['relu', 'elu', 'selu', 'tanh', 'sigmoid', 'gelu'] }, maxInputs: 1 },
  block: { type: 'block', defaults: { kind: 'mlp', units: 64, layers: 2, dropout: 0.1 }, enums: { kind: ['mlp', 'residual', 'cnn', 'lstm', 'transformer'] }, maxInputs: 1 },
  expert: { type: 'expert', defaults: { model: 'neural', units: 64, layers: 2, dropout: 0.1 }, enums: { model: ['neural', 'xgboost', 'lightgbm', 'random_forest', 'hist_gbdt', 'logistic', 'ridge'] }, maxInputs: 1 },
  gate: { type: 'gate', defaults: { mode: 'soft', k: 1, balance: 0.01, ruleFeature: '', ruleThreshold: 0, hidden: 0 }, enums: { mode: ['soft', 'topk', 'rule'] }, maxInputs: 16, hasCtrl: true },
  merge: { type: 'merge', defaults: { mode: 'concat' }, enums: { mode: ['concat', 'add', 'average', 'weighted', 'attention'] }, maxInputs: 16 },
  head: { type: 'head', defaults: { target: '', weight: 1 }, maxInputs: 1 },
};

export interface NodeInfo {
  /** output width; null when unknown (error upstream) */
  out: number | null;
  params: number;
  errors: string[];
}

export interface Analysis {
  info: Record<string, NodeInfo>;
  order: string[];
  errors: string[];
  totalParams: number;
  /** end-to-end TF.js training vs two-stage (heterogeneous experts: OOF experts, then gate) */
  mode: 'end-to-end' | 'two-stage';
  heads: string[];
}

export interface AnalyzeContext {
  inputDim: number;
  /** output width per target column (classes for classification, 1 for regression) */
  targetDims: Record<string, number>;
  /** raw feature columns (for rule gates) */
  features: string[];
}

const inEdges = (g: Graph, id: string) => g.edges.filter((e) => e.to === id);

export function topoOrder(g: Graph): { order: string[]; cyclic: boolean } {
  const indeg = new Map(g.nodes.map((n) => [n.id, 0]));
  for (const e of g.edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  const q = g.nodes.filter((n) => !indeg.get(n.id)).map((n) => n.id);
  const order: string[] = [];
  while (q.length) {
    const id = q.shift()!;
    order.push(id);
    for (const e of g.edges.filter((x) => x.from === id)) {
      indeg.set(e.to, indeg.get(e.to)! - 1);
      if (!indeg.get(e.to)) q.push(e.to);
    }
  }
  return { order, cyclic: order.length !== g.nodes.length };
}

const dense = (i: number, o: number) => i * o + o;

/** "Analyze": shape inference, parameter counts and errors for every node. */
export function analyze(g: Graph, ctx: AnalyzeContext): Analysis {
  const info: Record<string, NodeInfo> = {};
  const errors: string[] = [];
  const { order, cyclic } = topoOrder(g);
  if (cyclic) errors.push('cycle');
  const inputs = g.nodes.filter((n) => n.type === 'input');
  const heads = g.nodes.filter((n) => n.type === 'head');
  if (!inputs.length) errors.push('noInput');
  if (!heads.length) errors.push('noHead');
  // any non-neural expert ⇒ two-stage: every expert then outputs predictions (target width)
  const heterogeneous = g.nodes.some((n) => n.type === 'expert' && String(n.params.model) !== 'neural');
  for (const id of order) {
    const n = g.nodes.find((x) => x.id === id)!;
    const ins = inEdges(g, id);
    const data = ins.filter((e) => e.port === 'in').map((e) => info[e.from]?.out ?? null);
    const ctrl = ins.filter((e) => e.port === 'ctrl').map((e) => info[e.from]?.out ?? null);
    const errs: string[] = [];
    const spec = NODE_SPECS[n.type];
    let out: number | null = null, params = 0;
    const p = n.params;
    const one = () => {
      if (data.length !== 1) { errs.push(data.length ? 'tooManyInputs' : 'notConnected'); return null; }
      return data[0];
    };
    switch (n.type) {
      case 'input': out = ctx.inputDim; break;
      case 'dense': { const i = one(); if (i !== null) { out = Number(p.units); params = dense(i, out); } break; }
      case 'dropout': case 'activation': out = one(); break;
      case 'batchnorm': { const i = one(); out = i; params = i ? 4 * i : 0; break; }
      case 'block': {
        const i = one();
        const kind = String(p.kind);
        if (kind === 'cnn' || kind === 'lstm' || kind === 'transformer') errs.push('needsSequenceInput');
        if (i !== null) {
          const u = Number(p.units), L = Math.max(1, Number(p.layers));
          out = u;
          params = dense(i, u) + (L - 1) * dense(u, u) + (kind === 'residual' && i !== u ? i * u : 0) + (kind === 'residual' ? 4 * u * L : 0);
        }
        break;
      }
      case 'expert': {
        const i = one();
        if (heterogeneous) { out = ctx.targetDims[firstHeadTarget(g, id) ?? ''] ?? 1; break; }
        if (i !== null) { const u = Number(p.units), L = Math.max(1, Number(p.layers)); out = u; params = dense(i, u) + (L - 1) * dense(u, u); }
        break;
      }
      case 'gate': {
        if (ctrl.length !== 1) errs.push('gateNeedsCtrl');
        if (data.length < 2) errs.push('gateNeedsExperts');
        const dims = new Set(data);
        if (dims.size > 1) errs.push('expertDimsDiffer');
        if (String(p.mode) === 'rule') {
          if (data.length !== 2) errs.push('ruleNeedsTwoExperts');
          if (!ctx.features.includes(String(p.ruleFeature))) errs.push('ruleFeatureMissing');
        }
        if (String(p.mode) === 'topk' && (Number(p.k) < 1 || Number(p.k) >= data.length)) errs.push('topkRange');
        out = data[0] ?? null;
        const c = ctrl[0] ?? 0, h = Number(p.hidden) || 0;
        if (String(p.mode) !== 'rule') params = h > 0 ? dense(c, h) + dense(h, data.length) : dense(c, data.length);
        break;
      }
      case 'merge': {
        if (data.length < 2) errs.push('mergeNeedsTwo');
        const mode = String(p.mode);
        if (data.some((d) => d === null)) out = null;
        else if (mode === 'concat') out = (data as number[]).reduce((a, b) => a + b, 0);
        else {
          if (new Set(data).size > 1) errs.push('mergeDimsDiffer');
          out = data[0] ?? null;
          if (mode === 'weighted') params = data.length;
          if (mode === 'attention' && out) params = dense(out, 1);
        }
        break;
      }
      case 'head': {
        const i = one();
        const target = String(p.target);
        if (!target || !(target in ctx.targetDims)) errs.push('headTarget');
        out = ctx.targetDims[target] ?? 1;
        if (i !== null) params = dense(i, out);
        break;
      }
    }
    if (n.type !== 'input' && n.type !== 'head' && !g.edges.some((e) => e.from === id)) errs.push('deadEnd');
    if (spec.maxInputs === 0 && ins.length) errs.push('inputHasInputs');
    info[id] = { out, params, errors: errs };
  }
  if (new Set(heads.map((h) => String(h.params.target))).size !== heads.length) errors.push('duplicateHeadTarget');
  const totalParams = Object.values(info).reduce((a, b) => a + b.params, 0);
  return { info, order, errors, totalParams, mode: heterogeneous ? 'two-stage' : 'end-to-end', heads: heads.map((h) => h.id) };
}

/** Target of the first head reachable downstream of a node (used for plugin-expert output width). */
function firstHeadTarget(g: Graph, id: string): string | null {
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const n = g.nodes.find((x) => x.id === cur);
    if (n?.type === 'head') return String(n.params.target);
    for (const e of g.edges) if (e.from === cur) stack.push(e.to);
  }
  return null;
}

export function analysisOk(a: Analysis): boolean {
  return !a.errors.length && Object.values(a.info).every((i) => !i.errors.length);
}

/* ---------------- templates ---------------- */

let tid = 0;
const nid = (p: string) => `${p}${++tid}`;
type T = { nodes: GNode[]; edges: GEdge[] };
function node(t: T, type: NodeType, x: number, y: number, params: Params = {}, label?: string): string {
  const id = nid(type[0]);
  t.nodes.push({ id, type, x, y, params: { ...NODE_SPECS[type].defaults, ...params }, label });
  return id;
}
function edge(t: T, from: string, to: string, port: Port = 'in') {
  t.edges.push({ id: nid('e'), from, to, port });
}

export type TemplateId = 'mlp' | 'wideDeep' | 'moe' | 'moeTopK' | 'ruleRouting' | 'heteroMoe' | 'multiTask' | 'residual'
  | 'resnetTab' | 'snn' | 'denseNet' | 'inception' | 'switch' | 'mmoe';

export function template(id: TemplateId, targets: string[], features: string[]): Graph {
  tid = 0;
  const t: T = { nodes: [], edges: [] };
  const target = targets[0] ?? '';
  const inp = node(t, 'input', 60, 200, {}, 'features');
  const headAt = (from: string, x: number, y: number, tg = target) => { const h = node(t, 'head', x, y, { target: tg }); edge(t, from, h); return h; };
  switch (id) {
    case 'mlp': {
      const a = node(t, 'dense', 260, 200, { units: 128 }), d = node(t, 'dropout', 460, 200, { rate: 0.2 }), b = node(t, 'dense', 660, 200, { units: 64 });
      edge(t, inp, a); edge(t, a, d); edge(t, d, b); headAt(b, 860, 200);
      break;
    }
    case 'residual': {
      const a = node(t, 'block', 260, 120, { kind: 'residual', units: 64, layers: 2 }), b = node(t, 'block', 260, 300, { kind: 'mlp', units: 64, layers: 1 });
      const m = node(t, 'merge', 480, 200, { mode: 'add' }), c = node(t, 'block', 680, 200, { kind: 'residual', units: 64, layers: 2 });
      edge(t, inp, a); edge(t, inp, b); edge(t, a, m); edge(t, b, m); edge(t, m, c); headAt(c, 880, 200);
      break;
    }
    case 'wideDeep': {
      const wide = node(t, 'dense', 300, 90, { units: 16, activation: 'linear' }, 'wide');
      const deep = node(t, 'block', 300, 310, { kind: 'mlp', units: 128, layers: 3, dropout: 0.1 }, 'deep');
      const m = node(t, 'merge', 540, 200, { mode: 'concat' });
      edge(t, inp, wide); edge(t, inp, deep); edge(t, wide, m); edge(t, deep, m); headAt(m, 760, 200);
      break;
    }
    case 'moe': case 'moeTopK': {
      const g = node(t, 'gate', 560, 200, { mode: id === 'moe' ? 'soft' : 'topk', k: 2, hidden: 32 });
      for (let i = 0; i < 4; i++) { const e = node(t, 'expert', 320, 40 + i * 110, { model: 'neural', units: 64, layers: 2 }, `expert ${i + 1}`); edge(t, inp, e); edge(t, e, g); }
      edge(t, inp, g, 'ctrl'); headAt(g, 780, 200);
      break;
    }
    case 'ruleRouting': {
      const g = node(t, 'gate', 560, 200, { mode: 'rule', ruleFeature: features[0] ?? '', ruleThreshold: 0 });
      for (let i = 0; i < 2; i++) { const e = node(t, 'expert', 320, 110 + i * 180, { model: 'neural' }, i ? 'expert: condition true' : 'expert: condition false'); edge(t, inp, e); edge(t, e, g); }
      edge(t, inp, g, 'ctrl'); headAt(g, 780, 200);
      break;
    }
    case 'heteroMoe': {
      const g = node(t, 'gate', 560, 200, { mode: 'soft', hidden: 16 });
      (['xgboost', 'random_forest', 'neural'] as const).forEach((m, i) => { const e = node(t, 'expert', 320, 60 + i * 140, { model: m }, m); edge(t, inp, e); edge(t, e, g); });
      edge(t, inp, g, 'ctrl'); headAt(g, 780, 200);
      break;
    }
    case 'multiTask': {
      const shared = node(t, 'block', 300, 200, { kind: 'mlp', units: 128, layers: 2 }, 'shared trunk');
      edge(t, inp, shared);
      (targets.length > 1 ? targets.slice(0, 3) : [target]).forEach((tg, i) => {
        const tower = node(t, 'dense', 540, 80 + i * 150, { units: 32 }, `tower ${tg}`);
        edge(t, shared, tower); headAt(tower, 760, 80 + i * 150, tg);
      });
      break;
    }
    case 'resnetTab': {
      // Gorishniy et al. 2021: Linear → N × [BN → Linear → ReLU → Dropout → Linear → Dropout] + skip → BN → ReLU → Linear
      const stem = node(t, 'dense', 240, 200, { units: 128, activation: 'linear' }, 'linear stem');
      edge(t, inp, stem);
      let prev = stem;
      for (let i = 0; i < 3; i++) { const b = node(t, 'block', 420 + i * 170, 200, { kind: 'residual', units: 128, layers: 2, dropout: 0.1 }, `ResNet block ${i + 1}`); edge(t, prev, b); prev = b; }
      const bn = node(t, 'batchnorm', 930, 120), a = node(t, 'activation', 930, 280, { fn: 'relu' });
      edge(t, prev, bn); edge(t, bn, a); headAt(a, 1110, 200);
      break;
    }
    case 'snn': {
      // Klambauer et al. 2017: SELU dense layers (self-normalising), small dropout
      let prev = inp;
      for (let i = 0; i < 4; i++) { const d = node(t, 'dense', 240 + i * 170, i % 2 ? 280 : 120, { units: 128, activation: 'selu' }, `SELU ${i + 1}`); edge(t, prev, d); prev = d; }
      const dr = node(t, 'dropout', 920, 200, { rate: 0.05 }); edge(t, prev, dr); headAt(dr, 1100, 200);
      break;
    }
    case 'denseNet': {
      // Huang et al. 2017: each layer receives the concatenation of all earlier feature maps
      const l1 = node(t, 'dense', 260, 60, { units: 32 }, 'layer 1');
      edge(t, inp, l1);
      const c1 = node(t, 'merge', 440, 140, { mode: 'concat' }, 'concat [x, h1]'); edge(t, inp, c1); edge(t, l1, c1);
      const l2 = node(t, 'dense', 620, 60, { units: 32 }, 'layer 2'); edge(t, c1, l2);
      const c2 = node(t, 'merge', 800, 200, { mode: 'concat' }, 'concat [x, h1, h2]'); edge(t, inp, c2); edge(t, l1, c2); edge(t, l2, c2);
      const l3 = node(t, 'dense', 980, 200, { units: 64 }, 'transition'); edge(t, c2, l3); headAt(l3, 1160, 200);
      break;
    }
    case 'inception': {
      // Szegedy et al. 2015: parallel branches of different depth/width, concatenated
      const br = [
        node(t, 'dense', 300, 40, { units: 32 }, 'branch 1 (1 layer)'),
        node(t, 'block', 300, 160, { kind: 'mlp', units: 32, layers: 2, dropout: 0 }, 'branch 2 (2 layers)'),
        node(t, 'block', 300, 280, { kind: 'mlp', units: 32, layers: 3, dropout: 0 }, 'branch 3 (3 layers)'),
        node(t, 'dense', 300, 400, { units: 32, activation: 'linear' }, 'branch 4 (linear)'),
      ];
      const m = node(t, 'merge', 560, 220, { mode: 'concat' }, 'filter concat');
      for (const b of br) { edge(t, inp, b); edge(t, b, m); }
      const top = node(t, 'dense', 760, 220, { units: 64 }); edge(t, m, top); headAt(top, 940, 220);
      break;
    }
    case 'switch': {
      // Fedus et al. 2021/2022: top-1 routing over many experts with a load-balancing loss
      const g = node(t, 'gate', 600, 260, { mode: 'topk', k: 1, balance: 0.01, hidden: 0 }, 'switch router (top-1)');
      for (let i = 0; i < 8; i++) { const e = node(t, 'expert', 330, 10 + i * 68, { model: 'neural', units: 32, layers: 1, dropout: 0.1 }, `expert ${i + 1}`); edge(t, inp, e); edge(t, e, g); }
      edge(t, inp, g, 'ctrl'); headAt(g, 820, 260);
      break;
    }
    case 'mmoe': {
      // Ma et al. 2018: shared experts, one softmax gate + tower per task
      const ex = [0, 1, 2].map((i) => { const e = node(t, 'expert', 300, 60 + i * 150, { model: 'neural', units: 64, layers: 2 }, `shared expert ${i + 1}`); edge(t, inp, e); return e; });
      (targets.length > 1 ? targets.slice(0, 2) : [target]).forEach((tg, k) => {
        const g = node(t, 'gate', 560, 80 + k * 260, { mode: 'soft', hidden: 0, balance: 0 }, `gate ${tg}`);
        for (const e of ex) edge(t, e, g);
        edge(t, inp, g, 'ctrl');
        const tower = node(t, 'dense', 780, 80 + k * 260, { units: 32 }, `tower ${tg}`); edge(t, g, tower); headAt(tower, 980, 80 + k * 260, tg);
      });
      break;
    }
  }
  return { version: 1, nodes: t.nodes, edges: t.edges };
}
