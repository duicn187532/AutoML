/**
 * Minimal ONNX writer (hand-rolled protobuf; no dependencies).
 * Input "features" = the ENCODED feature vector (replay `preprocessing.json` first);
 * output "probabilities" (classification) or "prediction" (regression, model space → see target scaling).
 * Linear / MLP → MatMul, Add, Relu/Tanh/Sigmoid/Elu, Softmax (opset 13).
 * Trees (sklearn forests, HistGBDT, XGBoost, LightGBM) → ai.onnx.ml TreeEnsembleRegressor (opset 3)
 * producing margins / averaged probabilities, then Sigmoid / Softmax.
 */

/* ---------- protobuf primitives ---------- */
class W {
  bytes: number[] = [];
  varint(v: number | bigint) {
    let n = BigInt.asUintN(64, BigInt(v));
    while (n >= 0x80n) { this.bytes.push(Number((n & 0x7fn) | 0x80n)); n >>= 7n; }
    this.bytes.push(Number(n));
  }
  tag(field: number, wire: number) { this.varint((field << 3) | wire); }
  int(field: number, v: number) { this.tag(field, 0); this.varint(v); }
  str(field: number, s: string) { this.lenDelim(field, new TextEncoder().encode(s)); }
  lenDelim(field: number, b: Uint8Array | number[]) { this.tag(field, 2); this.varint(b.length); for (const x of b) this.bytes.push(x); }
  msg(field: number, m: W) { this.lenDelim(field, m.bytes); }
  float(field: number, v: number) { this.tag(field, 5); const b = new Uint8Array(new Float32Array([v]).buffer); this.bytes.push(...b); }
  packedFloats(field: number, vs: ArrayLike<number>) { this.lenDelim(field, new Uint8Array(Float32Array.from(vs).buffer)); }
  packedInts(field: number, vs: number[]) { const m = new W(); vs.forEach((v) => m.varint(v)); this.lenDelim(field, m.bytes); }
}

type Attr = { name: string } & ({ i: number } | { f: number } | { s: string } | { ints: number[] } | { floats: number[] } | { strings: string[] });
const ATTR = { FLOAT: 1, INT: 2, STRING: 3, FLOATS: 6, INTS: 7, STRINGS: 8 };

function attr(a: Attr): W {
  const w = new W();
  w.str(1, a.name);
  if ('f' in a) { w.float(2, a.f); w.int(20, ATTR.FLOAT); }
  else if ('i' in a) { w.int(3, a.i); w.int(20, ATTR.INT); }
  else if ('s' in a) { w.str(4, a.s); w.int(20, ATTR.STRING); }
  else if ('floats' in a) { w.packedFloats(7, a.floats); w.int(20, ATTR.FLOATS); }
  else if ('ints' in a) { w.packedInts(8, a.ints); w.int(20, ATTR.INTS); }
  else { a.strings.forEach((s) => w.str(9, s)); w.int(20, ATTR.STRINGS); }
  return w;
}

class Graph {
  nodes: W[] = [];
  inits: W[] = [];
  private n = 0;
  name(p: string) { return `${p}_${this.n++}`; }
  node(op: string, inputs: string[], outputs: string[], attrs: Attr[] = [], domain = '') {
    const w = new W();
    inputs.forEach((i) => w.str(1, i));
    outputs.forEach((o) => w.str(2, o));
    w.str(3, this.name(op));
    w.str(4, op);
    attrs.forEach((a) => w.msg(5, attr(a)));
    if (domain) w.str(7, domain);
    this.nodes.push(w);
    return outputs[0];
  }
  tensor(name: string, dims: number[], data: ArrayLike<number>) {
    const t = new W();
    dims.forEach((d) => t.int(1, d));
    t.int(2, 1); // FLOAT
    t.str(8, name);
    t.lenDelim(9, new Uint8Array(Float32Array.from(data).buffer));
    this.inits.push(t);
    return name;
  }
  op(op: string, inputs: string[], attrs: Attr[] = [], domain = '') { return this.node(op, inputs, [this.name(`${op}_out`)], attrs, domain); }
}

function valueInfo(name: string, dims: (number | string)[]): W {
  const shape = new W();
  for (const d of dims) { const dim = new W(); if (typeof d === 'number') dim.int(1, d); else dim.str(2, d); shape.msg(1, dim); }
  const tt = new W(); tt.int(1, 1); tt.msg(2, shape);
  const tp = new W(); tp.msg(1, tt);
  const vi = new W(); vi.str(1, name); vi.msg(2, tp);
  return vi;
}

/* ---------- model conversion ---------- */
interface Tree { feature: number[]; threshold: number[]; left: number[]; right: number[]; value: number[][]; leaf?: boolean[] }
interface Portable { kind: string; classifier?: boolean; classes?: number[]; W?: number[][]; b?: number[]; layers?: { W: number[][]; b: number[]; activation: string }[];
  trees?: Tree[]; treeClass?: number[]; baseScore?: number | number[]; objective?: string; baseline?: number[]; bestIteration?: number | null }

function treesNode(g: Graph, x: string, m: Portable, nTargets: number, scale: number, base: number[]): string {
  const A = { ids: [] as number[], tree: [] as number[], feat: [] as number[], val: [] as number[], mode: [] as string[], t: [] as number[], f: [] as number[], miss: [] as number[] };
  const T = { tree: [] as number[], node: [] as number[], target: [] as number[], w: [] as number[] };
  const per = m.kind === 'forest' ? 1 : nTargets;
  let n = m.trees!.length;
  if (m.bestIteration !== null && m.bestIteration !== undefined) n = Math.min(n, (m.bestIteration + (m.kind === 'xgboost' ? 1 : 0)) * per);
  const lt = m.kind === 'xgboost';
  for (let ti = 0; ti < n; ti++) {
    const tr = m.trees![ti];
    for (let i = 0; i < tr.feature.length; i++) {
      const leaf = tr.leaf ? tr.leaf[i] : tr.left[i] === -1;
      A.tree.push(ti); A.ids.push(i); A.feat.push(leaf ? 0 : tr.feature[i]); A.val.push(leaf ? 0 : tr.threshold[i]);
      A.mode.push(leaf ? 'LEAF' : lt ? 'BRANCH_LT' : 'BRANCH_LEQ'); A.t.push(leaf ? 0 : tr.left[i]); A.f.push(leaf ? 0 : tr.right[i]); A.miss.push(0);
      if (leaf) {
        if (m.kind === 'forest') tr.value[i].forEach((v, k) => { T.tree.push(ti); T.node.push(i); T.target.push(k); T.w.push(v * scale); });
        else { T.tree.push(ti); T.node.push(i); T.target.push(m.treeClass![ti] % nTargets); T.w.push(tr.value[i][0]); }
      }
    }
  }
  return g.op('TreeEnsembleRegressor', [x], [
    { name: 'n_targets', i: nTargets }, { name: 'aggregate_function', s: 'SUM' }, { name: 'post_transform', s: 'NONE' }, { name: 'base_values', floats: base },
    { name: 'nodes_treeids', ints: A.tree }, { name: 'nodes_nodeids', ints: A.ids }, { name: 'nodes_featureids', ints: A.feat }, { name: 'nodes_values', floats: A.val },
    { name: 'nodes_modes', strings: A.mode }, { name: 'nodes_truenodeids', ints: A.t }, { name: 'nodes_falsenodeids', ints: A.f }, { name: 'nodes_missing_value_tracks_true', ints: A.miss },
    { name: 'target_treeids', ints: T.tree }, { name: 'target_nodeids', ints: T.node }, { name: 'target_ids', ints: T.target }, { name: 'target_weights', floats: T.w },
  ], 'ai.onnx.ml');
}

/** Binary margin z → [1 − σ(z), σ(z)]. */
function binaryProba(g: Graph, z: string): string {
  const p = g.op('Sigmoid', [z]);
  const one = g.tensor(g.name('one'), [1], [1]);
  return g.op('Concat', [g.op('Sub', [one, p]), p], [{ name: 'axis', i: 1 }]);
}

export function portableToOnnx(model: Portable, nFeatures: number, nClasses: number): Uint8Array {
  const g = new Graph();
  const cls = nClasses > 0;
  let y: string;
  const x = 'features';
  if (model.kind === 'linear' || model.kind === 'mlp') {
    const layers = model.kind === 'linear'
      ? [{ W: model.W!, b: model.b!, activation: model.classifier ? (model.b!.length === 1 ? 'sigmoid1' : 'softmax') : 'linear' }]
      : model.layers!;
    let h = x;
    for (const l of layers) {
      const din = l.W.length, dout = l.b.length;
      h = g.op('Add', [g.op('MatMul', [h, g.tensor(g.name('W'), [din, dout], l.W.flat())]), g.tensor(g.name('b'), [dout], l.b)]);
      if (l.activation === 'relu') h = g.op('Relu', [h]);
      else if (l.activation === 'tanh') h = g.op('Tanh', [h]);
      else if (l.activation === 'sigmoid') h = g.op('Sigmoid', [h]);
      else if (l.activation === 'elu') h = g.op('Elu', [h], [{ name: 'alpha', f: 1 }]);
      else if (l.activation === 'softmax') h = g.op('Softmax', [h], [{ name: 'axis', i: 1 }]);
      else if (l.activation === 'sigmoid1') h = binaryProba(g, h);
    }
    y = h;
  } else {
    const isForest = model.kind === 'forest';
    const k = cls ? (isForest ? nClasses : model.kind === 'hgb' ? model.baseline!.length : model.classes && model.classes.length > 2 ? model.classes.length : 1) : 1;
    let base = new Array<number>(k).fill(0);
    if (model.kind === 'hgb') base = model.baseline!;
    if (model.kind === 'xgboost') {
      const bsv = ([] as number[]).concat(model.baseScore!);
      base = base.map((_, i) => { const bs = bsv.length === k ? bsv[i] : bsv[0]; return /logistic/.test(model.objective ?? '') ? Math.log(bs / (1 - bs)) : bs; });
    }
    const z = treesNode(g, x, model, k, isForest ? 1 / model.trees!.length : 1, base);
    y = !cls || isForest ? z : k === 1 ? binaryProba(g, z) : g.op('Softmax', [z], [{ name: 'axis', i: 1 }]);
  }
  const outName = cls ? 'probabilities' : 'prediction';
  g.node('Identity', [y], [outName]);
  const graph = new W();
  g.nodes.forEach((n) => graph.msg(1, n));
  graph.str(2, 'aml_model');
  g.inits.forEach((t) => graph.msg(5, t));
  graph.msg(11, valueInfo(x, ['N', nFeatures]));
  graph.msg(12, valueInfo(outName, ['N', cls ? nClasses : 1]));
  const m = new W();
  m.int(1, 8); // IR version
  m.str(2, 'AutoML Workbench');
  const op = new W(); op.str(1, ''); op.int(2, 13); m.msg(8, op);
  const ml = new W(); ml.str(1, 'ai.onnx.ml'); ml.int(2, 3); m.msg(8, ml);
  m.msg(7, graph);
  return Uint8Array.from(m.bytes);
}
