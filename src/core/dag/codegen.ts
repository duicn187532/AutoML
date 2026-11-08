import { topoOrder, type GNode, type Graph } from './graph';

/** Generate Keras (functional), PyTorch (nn.Module) or TF.js code from an architecture graph. */
export type CodeTarget = 'keras' | 'pytorch' | 'tfjs';

const v = (id: string) => `x_${id}`;
const ins = (g: Graph, id: string, port = 'in') => g.edges.filter((e) => e.to === id && e.port === port).map((e) => e.from);

export function graphToCode(g: Graph, target: CodeTarget, ctx: { inputDim: number; headDims: Record<string, number>; headTasks: Record<string, string> }): string {
  const { order } = topoOrder(g);
  const nodes = order.map((id) => g.nodes.find((n) => n.id === id)!);
  if (target === 'keras') return keras(g, nodes, ctx);
  if (target === 'pytorch') return pytorch(g, nodes, ctx);
  return tfjs(g, nodes, ctx);
}

function keras(g: Graph, nodes: GNode[], ctx: { inputDim: number; headDims: Record<string, number>; headTasks: Record<string, string> }): string {
  const L: string[] = ['import tensorflow as tf', 'from tensorflow import keras', 'from tensorflow.keras import layers', '', 'inputs, outputs = [], []'];
  for (const n of nodes) {
    const p = n.params, x = ins(g, n.id).map(v), id = n.id;
    switch (n.type) {
      case 'input': L.push(`${v(id)} = keras.Input(shape=(${ctx.inputDim},), name="${id}")`, `inputs.append(${v(id)})`); break;
      case 'dense': L.push(`${v(id)} = layers.Dense(${p.units}, activation="${p.activation}")(${x[0]})`); break;
      case 'dropout': L.push(`${v(id)} = layers.Dropout(${p.rate})(${x[0]})`); break;
      case 'batchnorm': L.push(`${v(id)} = layers.BatchNormalization()(${x[0]})`); break;
      case 'activation': L.push(`${v(id)} = layers.Activation("${p.fn}")(${x[0]})`); break;
      case 'block': case 'expert':
        if (n.type === 'expert' && p.model !== 'neural') { L.push(`# ${id}: ${p.model} expert → trained separately (two-stage); feed its OOF predictions as an extra input`); L.push(`${v(id)} = keras.Input(shape=(None,), name="${id}_oof")`, `inputs.append(${v(id)})`); break; }
        L.push(`h = ${x[0]}`);
        if (p.kind === 'residual') L.push(`skip = h if h.shape[-1] == ${p.units} else layers.Dense(${p.units}, use_bias=False)(h)`);
        L.push(`for _ in range(${p.layers}):`, `    h = layers.Dense(${p.units}, activation="relu")(h)` + (p.kind === 'residual' ? '\n    h = layers.BatchNormalization()(h)' : ''), ...(Number(p.dropout) > 0 ? [`    h = layers.Dropout(${p.dropout})(h)`] : []), ...(p.kind === 'residual' ? ['    h = layers.Add()([h, skip]); skip = h'] : []), `${v(id)} = h`);
        break;
      case 'gate': {
        const c = v(ins(g, id, 'ctrl')[0]);
        L.push(`experts_${id} = layers.Lambda(lambda t: tf.stack(t, axis=1))([${x.join(', ')}])  # [b, E, d]`);
        if (p.mode === 'rule') L.push(`# rule routing on feature "${p.ruleFeature}" > ${p.ruleThreshold} (standardised column index must be supplied)`, `g_${id} = layers.Lambda(lambda t: tf.one_hot(tf.cast(t[:, RULE_INDEX] > RULE_Z, tf.int32), 2))(${c})`);
        else {
          L.push(`logits_${id} = layers.Dense(${x.length})(${Number(p.hidden) > 0 ? `layers.Dense(${p.hidden}, activation="relu")(${c})` : c})`);
          if (p.mode === 'topk') L.push(`g_${id} = layers.Lambda(lambda z: tf.nn.softmax(tf.where(z >= tf.math.top_k(z, ${p.k}).values[:, -1:], z, -1e9)))(logits_${id})`);
          else L.push(`g_${id} = layers.Softmax()(logits_${id})`);
          if (Number(p.balance) > 0) L.push(`# load balancing: add ${p.balance} * E * sum(mean(g)^2) via model.add_loss`);
        }
        L.push(`${v(id)} = layers.Dot(axes=(1, 1))([g_${id}, experts_${id}])`);
        break;
      }
      case 'merge': {
        const m = String(p.mode);
        if (m === 'concat') L.push(`${v(id)} = layers.Concatenate()([${x.join(', ')}])`);
        else if (m === 'add') L.push(`${v(id)} = layers.Add()([${x.join(', ')}])`);
        else if (m === 'average') L.push(`${v(id)} = layers.Average()([${x.join(', ')}])`);
        else L.push(`stack = layers.Lambda(lambda t: tf.stack(t, axis=1))([${x.join(', ')}])`, m === 'attention'
          ? `w = layers.Softmax(axis=1)(layers.Dense(1)(stack))\n${v(id)} = layers.Lambda(lambda t: tf.reduce_sum(t[0] * t[1], axis=1))([stack, w])`
          : `w = tf.Variable(tf.zeros(${x.length}))  # learned mixture weights\n${v(id)} = layers.Lambda(lambda s: tf.einsum("e,bed->bd", tf.nn.softmax(w), s))(stack)`);
        break;
      }
      case 'head': {
        const t = ctx.headTasks[id], d = ctx.headDims[id];
        L.push(`${v(id)} = layers.Dense(${d}, activation="${t === 'regression' ? 'linear' : 'softmax'}", name="${String(p.target).replace(/\W/g, '_') || id}")(${x[0]})`, `outputs.append(${v(id)})`);
        break;
      }
    }
  }
  const losses = nodes.filter((n) => n.type === 'head').map((n) => `"${ctx.headTasks[n.id] === 'regression' ? 'mse' : 'sparse_categorical_crossentropy'}"`);
  const weights = nodes.filter((n) => n.type === 'head').map((n) => String(n.params.weight ?? 1));
  L.push('', 'model = keras.Model(inputs=inputs, outputs=outputs)', `model.compile(optimizer=keras.optimizers.Adam(1e-3), loss=[${losses.join(', ')}], loss_weights=[${weights.join(', ')}])`, 'model.summary()');
  return L.join('\n') + '\n';
}

function pytorch(g: Graph, nodes: GNode[], ctx: { inputDim: number; headDims: Record<string, number>; headTasks: Record<string, string> }): string {
  const init: string[] = [], fwd: string[] = [];
  const dims = new Map<string, number>();
  for (const n of nodes) {
    const p = n.params, x = ins(g, n.id), id = n.id, d0 = dims.get(x[0]) ?? 0;
    switch (n.type) {
      case 'input': dims.set(id, ctx.inputDim); fwd.push(`${v(id)} = x`); break;
      case 'dense': init.push(`self.${id} = nn.Linear(${d0}, ${p.units})`); fwd.push(`${v(id)} = ${p.activation === 'linear' ? '' : `F.${p.activation === 'sigmoid' ? 'sigmoid' : p.activation}`}(self.${id}(${v(x[0])}))`); dims.set(id, Number(p.units)); break;
      case 'dropout': init.push(`self.${id} = nn.Dropout(${p.rate})`); fwd.push(`${v(id)} = self.${id}(${v(x[0])})`); dims.set(id, d0); break;
      case 'batchnorm': init.push(`self.${id} = nn.BatchNorm1d(${d0})`); fwd.push(`${v(id)} = self.${id}(${v(x[0])})`); dims.set(id, d0); break;
      case 'activation': fwd.push(`${v(id)} = F.${p.fn}(${v(x[0])})`); dims.set(id, d0); break;
      case 'block': case 'expert': {
        if (n.type === 'expert' && p.model !== 'neural') { fwd.push(`${v(id)} = extra["${id}"]  # ${p.model} OOF predictions (two-stage)`); dims.set(id, 0); break; }
        const u = Number(p.units), layers = Math.max(1, Number(p.layers));
        const mods = Array.from({ length: layers }, (_, i) => `nn.Linear(${i ? u : d0}, ${u}), nn.ReLU()` + (Number(p.dropout) > 0 ? `, nn.Dropout(${p.dropout})` : '')).join(', ');
        init.push(`self.${id} = nn.Sequential(${mods})`);
        if (p.kind === 'residual') { init.push(`self.${id}_proj = nn.Identity() if ${d0} == ${u} else nn.Linear(${d0}, ${u}, bias=False)`); fwd.push(`${v(id)} = self.${id}(${v(x[0])}) + self.${id}_proj(${v(x[0])})`); }
        else fwd.push(`${v(id)} = self.${id}(${v(x[0])})`);
        dims.set(id, u);
        break;
      }
      case 'gate': {
        const c = ins(g, id, 'ctrl')[0], dc = dims.get(c) ?? 0, E = x.length;
        fwd.push(`experts = torch.stack([${x.map(v).join(', ')}], dim=1)  # [b, E, d]`);
        if (p.mode === 'rule') fwd.push(`g = F.one_hot((${v(c)}[:, RULE_INDEX] > RULE_Z).long(), 2).float()  # rule on "${p.ruleFeature}"`);
        else {
          init.push(Number(p.hidden) > 0 ? `self.${id} = nn.Sequential(nn.Linear(${dc}, ${p.hidden}), nn.ReLU(), nn.Linear(${p.hidden}, ${E}))` : `self.${id} = nn.Linear(${dc}, ${E})`);
          fwd.push(`logits = self.${id}(${v(c)})`);
          fwd.push(p.mode === 'topk' ? `kth = logits.topk(${p.k}, dim=1).values[:, -1:]\ng = F.softmax(logits.masked_fill(logits < kth, -1e9), dim=1)` : 'g = F.softmax(logits, dim=1)');
          if (Number(p.balance) > 0) fwd.push(`self.aux_loss = self.aux_loss + ${p.balance} * ${E} * (g.mean(0) ** 2).sum()  # load balancing`);
        }
        fwd.push(`${v(id)} = torch.einsum("be,bed->bd", g, experts)`);
        dims.set(id, dims.get(x[0]) ?? 0);
        break;
      }
      case 'merge': {
        const m = String(p.mode), ds = x.map((i) => dims.get(i) ?? 0);
        if (m === 'concat') { fwd.push(`${v(id)} = torch.cat([${x.map(v).join(', ')}], dim=1)`); dims.set(id, ds.reduce((a, b) => a + b, 0)); }
        else if (m === 'add') { fwd.push(`${v(id)} = ${x.map(v).join(' + ')}`); dims.set(id, ds[0]); }
        else if (m === 'average') { fwd.push(`${v(id)} = (${x.map(v).join(' + ')}) / ${x.length}`); dims.set(id, ds[0]); }
        else if (m === 'weighted') { init.push(`self.${id} = nn.Parameter(torch.zeros(${x.length}))`); fwd.push(`${v(id)} = torch.einsum("e,bed->bd", F.softmax(self.${id}, 0), torch.stack([${x.map(v).join(', ')}], 1))`); dims.set(id, ds[0]); }
        else { init.push(`self.${id} = nn.Linear(${ds[0]}, 1)`); fwd.push(`s = torch.stack([${x.map(v).join(', ')}], 1)\n${v(id)} = (s * F.softmax(self.${id}(s), dim=1)).sum(1)`); dims.set(id, ds[0]); }
        break;
      }
      case 'head': init.push(`self.${id} = nn.Linear(${d0}, ${ctx.headDims[id]})  # ${ctx.headTasks[id]} → ${p.target}`); fwd.push(`${v(id)} = self.${id}(${v(x[0])})  # logits / value`); break;
    }
  }
  const heads = nodes.filter((n) => n.type === 'head').map((n) => v(n.id));
  return ['import torch', 'from torch import nn', 'import torch.nn.functional as F', '', '', 'class Net(nn.Module):', '    def __init__(self):', '        super().__init__()',
    ...init.map((l) => `        ${l}`), '', '    def forward(self, x, extra=None):', '        self.aux_loss = torch.zeros(())',
    ...fwd.flatMap((l) => l.split('\n').map((s) => `        ${s}`)), `        return ${heads.length === 1 ? heads[0] : `(${heads.join(', ')})`}`, '', '', 'model = Net()', 'print(model)', ''].join('\n');
}

function tfjs(g: Graph, nodes: GNode[], ctx: { inputDim: number; headDims: Record<string, number>; headTasks: Record<string, string> }): string {
  const L = ["import * as tf from '@tensorflow/tfjs';", '', 'const inputs = [], outputs = [];'];
  for (const n of nodes) {
    const p = n.params, x = ins(g, n.id).map(v), id = n.id;
    switch (n.type) {
      case 'input': L.push(`const ${v(id)} = tf.input({ shape: [${ctx.inputDim}] }); inputs.push(${v(id)});`); break;
      case 'dense': L.push(`const ${v(id)} = tf.layers.dense({ units: ${p.units}, activation: '${p.activation}' }).apply(${x[0]});`); break;
      case 'dropout': L.push(`const ${v(id)} = tf.layers.dropout({ rate: ${p.rate} }).apply(${x[0]});`); break;
      case 'batchnorm': L.push(`const ${v(id)} = tf.layers.batchNormalization().apply(${x[0]});`); break;
      case 'activation': L.push(`const ${v(id)} = tf.layers.activation({ activation: '${p.fn}' }).apply(${x[0]});`); break;
      case 'block': case 'expert': L.push(`let h_${id} = ${x[0]};`, `for (let i = 0; i < ${p.layers}; i++) h_${id} = tf.layers.dense({ units: ${p.units}, activation: 'relu' }).apply(h_${id});`, `const ${v(id)} = h_${id};`); break;
      case 'gate': {
        const c = v(ins(g, id, 'ctrl')[0]);
        L.push(`const g_${id} = tf.layers.dense({ units: ${x.length}, activation: 'softmax' }).apply(${c}); // ${p.mode} gate (top-k / rule need a custom layer)`,
          `const s_${id} = tf.layers.concatenate({ axis: 1 }).apply([${x.map((e) => `tf.layers.reshape({ targetShape: [1, ${'-1'}] }).apply(${e})`).join(', ')}]);`,
          `const ${v(id)} = tf.layers.dot({ axes: [1, 1] }).apply([g_${id}, s_${id}]);`);
        break;
      }
      case 'merge': L.push(`const ${v(id)} = tf.layers.${p.mode === 'add' ? 'add' : p.mode === 'average' ? 'average' : 'concatenate'}().apply([${x.join(', ')}]);${p.mode === 'weighted' || p.mode === 'attention' ? ` // ${p.mode}: see Keras/PyTorch export` : ''}`); break;
      case 'head': L.push(`const ${v(id)} = tf.layers.dense({ units: ${ctx.headDims[id]}, activation: '${ctx.headTasks[id] === 'regression' ? 'linear' : 'softmax'}' }).apply(${x[0]}); outputs.push(${v(id)});`); break;
    }
  }
  L.push('', 'export const model = tf.model({ inputs, outputs });', 'model.summary();');
  return L.join('\n') + '\n';
}
