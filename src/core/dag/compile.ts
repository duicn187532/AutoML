import type * as TF from '@tensorflow/tfjs';
import type { Graph, GNode } from './graph';
import { topoOrder } from './graph';

type Tf = typeof TF;
type ST = TF.SymbolicTensor;

export interface CompileContext {
  inputDim: number;
  /** per head node: task + output width */
  heads: Record<string, { target: string; task: 'binary' | 'multiclass' | 'regression'; dim: number; weight: number }>;
  /** rule gates: index of the (standardised) feature column and threshold in standardised units */
  rules: Record<string, { index: number; z: number }>;
  seed: number;
}

export interface Compiled {
  model: TF.LayersModel;
  /** output order: heads, then auxiliary balance outputs of top-k / soft gates */
  outputs: { kind: 'head' | 'balance'; node: string }[];
  /** gate node → model that outputs the gate's routing weights (for visualisation) */
  gateProbes: Record<string, TF.LayersModel>;
}

let registered = false;
/** Custom layers are defined lazily because `tf` only exists inside the worker after the engine loads. */
function customLayers(tf: Tf) {
  class TopKMask extends tf.layers.Layer {
    static className = 'AmlTopKMask';
    k: number;
    constructor(cfg: { k: number; name?: string }) { super(cfg); this.k = cfg.k; }
    computeOutputShape(s: TF.Shape | TF.Shape[]) { return s; }
    call(inputs: TF.Tensor | TF.Tensor[]) {
      return tf.tidy(() => {
        const logits = (Array.isArray(inputs) ? inputs[0] : inputs) as TF.Tensor2D;
        // top-k selection is piecewise constant: compute the mask with a zero custom gradient
        // (tf.topk has no gradient in TF.js); gradients flow through the kept logits.
        const k = this.k;
        const maskOf = tf.customGrad(((z: TF.Tensor, save: (t: TF.Tensor[]) => void) => {
          save([z]);
          const kth = tf.topk(z as TF.Tensor2D, k).values.min(1, true);
          return { value: tf.cast(tf.greaterEqual(z, kth), 'float32'), gradFunc: (_dy: TF.Tensor, saved: TF.Tensor[]) => tf.zerosLike(saved[0]) };
        }) as never) as (z: TF.Tensor) => TF.Tensor;
        const mask = maskOf(logits);
        const masked = tf.add(tf.mul(logits, mask), tf.mul(tf.sub(1, mask), -1e9));
        return tf.softmax(masked);
      });
    }
    getConfig() { return { ...super.getConfig(), k: this.k }; }
  }
  class RuleRoute extends tf.layers.Layer {
    static className = 'AmlRuleRoute';
    index: number; z: number;
    constructor(cfg: { index: number; z: number; name?: string }) { super(cfg); this.index = cfg.index; this.z = cfg.z; }
    computeOutputShape(s: TF.Shape | TF.Shape[]) { return [(s as TF.Shape)[0], 2]; }
    call(inputs: TF.Tensor | TF.Tensor[]) {
      return tf.tidy(() => {
        const x = (Array.isArray(inputs) ? inputs[0] : inputs) as TF.Tensor2D;
        const col = x.slice([0, this.index], [-1, 1]);
        const yes = tf.cast(tf.greater(col, this.z), 'float32');
        return tf.concat([tf.sub(1, yes), yes], 1); // [false, true]
      });
    }
    getConfig() { return { ...super.getConfig(), index: this.index, z: this.z }; }
  }
  class AttentionPool extends tf.layers.Layer {
    static className = 'AmlAttentionPool';
    computeOutputShape(s: TF.Shape | TF.Shape[]) { const sh = s as TF.Shape; return [sh[0], sh[2]]; }
    call(inputs: TF.Tensor | TF.Tensor[]) {
      return tf.tidy(() => {
        const [stack, scores] = inputs as TF.Tensor[]; // [b,E,d], [b,E,1]
        const w = tf.softmax(scores.squeeze([2]), 1).expandDims(2);
        return tf.sum(tf.mul(stack, w), 1);
      });
    }
  }
  if (!registered) {
    tf.serialization.registerClass(TopKMask as never);
    tf.serialization.registerClass(RuleRoute as never);
    tf.serialization.registerClass(AttentionPool as never);
    registered = true;
  }
  return { TopKMask, RuleRoute, AttentionPool };
}

/** Load-balancing auxiliary loss on gate probabilities: E · Σ_e mean_b(g)_e² (minimised by uniform use). */
export function balanceLoss(tf: Tf) {
  return (_yTrue: TF.Tensor, yPred: TF.Tensor) => tf.tidy(() => {
    const importance = tf.mean(yPred, 0);
    return tf.mul(tf.sum(tf.square(importance)), yPred.shape[1] as number);
  });
}

export function compileGraph(tf: Tf, g: Graph, ctx: CompileContext): Compiled {
  const L = customLayers(tf);
  const { order } = topoOrder(g);
  const out = new Map<string, ST>();
  const gateProbe = new Map<string, ST>();
  const balance: { node: string; t: ST }[] = [];
  const inputs: TF.SymbolicTensor[] = [];
  let s = ctx.seed;
  const init = () => tf.initializers.glorotUniform({ seed: ++s });
  const ins = (id: string, port = 'in') => g.edges.filter((e) => e.to === id && e.port === port).map((e) => out.get(e.from)!);
  const act = (a: string) => (a === 'gelu' ? 'linear' : a) as 'relu';
  const denseStack = (x: ST, n: GNode, prefix: string): ST => {
    const units = Number(n.params.units), layers = Math.max(1, Number(n.params.layers)), drop = Number(n.params.dropout ?? 0);
    let h = x;
    for (let i = 0; i < layers; i++) {
      h = tf.layers.dense({ units, activation: 'relu', kernelInitializer: init(), name: `${prefix}_d${i}` }).apply(h) as ST;
      if (drop > 0) h = tf.layers.dropout({ rate: drop, seed: ++s, name: `${prefix}_drop${i}` }).apply(h) as ST;
    }
    return h;
  };
  for (const id of order) {
    const n = g.nodes.find((x) => x.id === id)!;
    const p = n.params;
    const x = ins(id)[0];
    let y: ST;
    switch (n.type) {
      case 'input': { const i = tf.input({ shape: [ctx.inputDim], name: `in_${id}` }); inputs.push(i); y = i; break; }
      case 'dense':
        y = tf.layers.dense({ units: Number(p.units), activation: act(String(p.activation)), kernelInitializer: init(), kernelRegularizer: Number(p.l2) > 0 ? tf.regularizers.l2({ l2: Number(p.l2) }) : undefined, name: id }).apply(x) as ST;
        if (p.activation === 'gelu') y = tf.layers.activation({ activation: 'gelu' as never, name: `${id}_gelu` }).apply(y) as ST;
        break;
      case 'dropout': y = tf.layers.dropout({ rate: Number(p.rate), seed: ++s, name: id }).apply(x) as ST; break;
      case 'batchnorm': y = tf.layers.batchNormalization({ name: id }).apply(x) as ST; break;
      case 'activation': y = tf.layers.activation({ activation: act(String(p.fn)), name: id }).apply(x) as ST; break;
      case 'block': {
        if (p.kind === 'residual') {
          const units = Number(p.units);
          let h = x;
          const skip0 = (x.shape[1] === units ? x : tf.layers.dense({ units, useBias: false, kernelInitializer: init(), name: `${id}_proj` }).apply(x)) as ST;
          let skip = skip0;
          for (let i = 0; i < Math.max(1, Number(p.layers)); i++) {
            h = tf.layers.dense({ units, kernelInitializer: init(), name: `${id}_d${i}` }).apply(h) as ST;
            h = tf.layers.batchNormalization({ name: `${id}_bn${i}` }).apply(h) as ST;
            h = tf.layers.activation({ activation: 'relu', name: `${id}_a${i}` }).apply(h) as ST;
            if (Number(p.dropout) > 0) h = tf.layers.dropout({ rate: Number(p.dropout), seed: ++s, name: `${id}_drop${i}` }).apply(h) as ST;
            h = tf.layers.add({ name: `${id}_res${i}` }).apply([h, skip]) as ST;
            skip = h;
          }
          y = h;
        } else if (p.kind === 'mlp') y = denseStack(x, n, id);
        else throw new Error(`Block "${p.kind}" needs image / sequence inputs (not available for tabular data yet)`);
        break;
      }
      case 'expert':
        if (p.model !== 'neural') throw new Error('Heterogeneous experts use two-stage training');
        y = denseStack(x, n, id);
        break;
      case 'gate': {
        const experts = ins(id);
        const ctrl = ins(id, 'ctrl')[0];
        let weights: ST;
        if (p.mode === 'rule') {
          weights = new L.RuleRoute({ index: ctx.rules[id].index, z: ctx.rules[id].z, name: `${id}_rule` }).apply(ctrl) as ST;
        } else {
          let h = ctrl;
          if (Number(p.hidden) > 0) h = tf.layers.dense({ units: Number(p.hidden), activation: 'relu', kernelInitializer: init(), name: `${id}_h` }).apply(h) as ST;
          const logits = tf.layers.dense({ units: experts.length, kernelInitializer: init(), name: `${id}_logits` }).apply(h) as ST;
          weights = (p.mode === 'topk'
            ? new L.TopKMask({ k: Number(p.k), name: `${id}_topk` }).apply(logits)
            : tf.layers.softmax({ name: `${id}_softmax` }).apply(logits)) as ST;
          if (Number(p.balance) > 0) balance.push({ node: id, t: weights });
        }
        gateProbe.set(id, weights);
        const d = experts[0].shape[1] as number;
        const stacked = tf.layers.concatenate({ axis: 1, name: `${id}_stack` }).apply(
          experts.map((e, i) => tf.layers.reshape({ targetShape: [1, d], name: `${id}_r${i}` }).apply(e) as ST)) as ST; // [b,E,d]
        y = tf.layers.dot({ axes: [1, 1], name: `${id}_mix` }).apply([weights, stacked]) as ST; // [b,d]
        break;
      }
      case 'merge': {
        const xs = ins(id);
        const mode = String(p.mode);
        if (mode === 'concat') y = tf.layers.concatenate({ name: id }).apply(xs) as ST;
        else if (mode === 'add') y = tf.layers.add({ name: id }).apply(xs) as ST;
        else if (mode === 'average') y = tf.layers.average({ name: id }).apply(xs) as ST;
        else {
          const d = xs[0].shape[1] as number;
          const stacked = tf.layers.concatenate({ axis: 1, name: `${id}_stack` }).apply(xs.map((e, i) => tf.layers.reshape({ targetShape: [1, d], name: `${id}_r${i}` }).apply(e) as ST)) as ST;
          if (mode === 'weighted') {
            // learned, input-independent mixture weights (softmax over a trainable vector)
            const ones = tf.layers.dense({ units: 1, useBias: false, kernelInitializer: 'zeros', trainable: false, name: `${id}_one` }).apply(xs[0]) as ST;
            const w = tf.layers.dense({ units: xs.length, kernelInitializer: 'zeros', activation: 'softmax', name: `${id}_w` }).apply(ones) as ST;
            y = tf.layers.dot({ axes: [1, 1], name: `${id}_mix` }).apply([w, stacked]) as ST;
          } else {
            const scores = tf.layers.dense({ units: 1, kernelInitializer: init(), name: `${id}_score` }).apply(stacked) as ST; // [b,E,1]
            y = new L.AttentionPool({ name: `${id}_attn` }).apply([stacked, scores]) as ST;
          }
        }
        break;
      }
      case 'head': {
        const h = ctx.heads[id];
        y = tf.layers.dense({ units: h.dim, activation: h.task === 'regression' ? 'linear' : 'softmax', kernelInitializer: init(), name: `head_${id}` }).apply(x) as ST;
        break;
      }
    }
    out.set(id, y!);
  }
  const headIds = g.nodes.filter((n) => n.type === 'head').map((n) => n.id);
  const outputs: Compiled['outputs'] = [...headIds.map((node) => ({ kind: 'head' as const, node })), ...balance.map((b) => ({ kind: 'balance' as const, node: b.node }))];
  const model = tf.model({ inputs, outputs: [...headIds.map((h) => out.get(h)!), ...balance.map((b) => b.t)] });
  const gateProbes: Record<string, TF.LayersModel> = {};
  for (const [id, t] of gateProbe) gateProbes[id] = tf.model({ inputs, outputs: t });
  return { model, outputs, gateProbes };
}
