import type * as TF from '@tensorflow/tfjs';
import type { Backbone } from '../../engines/adapters';
import { classificationMetrics, confusionMatrix } from '../../ml/metrics';
import { holdoutSplit } from '../../ml/split';
import { Rng } from '../../rng';
import type { EngineName } from '../../models/types';
import type { ImageModelArtifact, PredictImageInput, TaskContext, TrainImageInput, TrainImageOutput } from '../types';

type Tf = typeof TF;

/** Decode to size×size RGB uint8 (centre crop). */
async function decodeRGB(bytes: Uint8Array, size: number): Promise<Uint8Array> {
  const bmp = await createImageBitmap(new Blob([bytes as BlobPart]));
  const c = new OffscreenCanvas(size, size), g = c.getContext('2d')!;
  const s = Math.min(bmp.width, bmp.height);
  g.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  bmp.close();
  const px = g.getImageData(0, 0, size, size).data, out = new Uint8Array(size * size * 3);
  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) { out[j] = px[i]; out[j + 1] = px[i + 1]; out[j + 2] = px[i + 2]; }
  return out;
}

/** uint8 images → float tensor in [-1, 1], optionally augmented (flip / crop / colour). */
function batchTensor(tf: Tf, imgs: Uint8Array[], size: number, aug: TrainImageInput['augment'] | null, rng: Rng): TF.Tensor4D {
  return tf.tidy(() => {
    const buf = new Float32Array(imgs.length * size * size * 3);
    imgs.forEach((im, i) => { for (let j = 0; j < im.length; j++) buf[i * im.length + j] = im[j] / 127.5 - 1; });
    let x = tf.tensor4d(buf, [imgs.length, size, size, 3]);
    if (aug?.flip) {
      const flipMask = Array.from({ length: imgs.length }, () => rng.next() < 0.5);
      if (flipMask.some(Boolean)) {
        const flipped = tf.image.flipLeftRight(x);
        x = tf.where(tf.tensor1d(flipMask, 'bool').reshape([-1, 1, 1, 1]).tile([1, size, size, 3]), flipped, x) as TF.Tensor4D;
      }
    }
    if (aug?.crop) {
      const boxes = imgs.map(() => { const s = 0.8 + 0.2 * rng.next(), y0 = rng.next() * (1 - s), x0 = rng.next() * (1 - s); return [y0, x0, y0 + s, x0 + s]; });
      x = tf.image.cropAndResize(x, tf.tensor2d(boxes), tf.tensor1d(imgs.map((_, i) => i), 'int32'), [size, size]);
    }
    if (aug?.color) x = tf.clipByValue(tf.add(tf.mul(x, tf.tensor4d(imgs.map(() => 0.8 + 0.4 * rng.next()), [imgs.length, 1, 1, 1])), tf.tensor4d(imgs.map(() => (rng.next() - 0.5) * 0.3), [imgs.length, 1, 1, 1])), -1, 1) as TF.Tensor4D;
    return x;
  });
}

function scratchCnn(tf: Tf, size: number, k: number, seed: number): TF.LayersModel {
  const m = tf.sequential();
  [32, 64, 128].forEach((f, i) => {
    m.add(tf.layers.conv2d({ filters: f, kernelSize: 3, padding: 'same', inputShape: i === 0 ? [size, size, 3] : undefined, kernelInitializer: tf.initializers.heNormal({ seed: seed + i }) }));
    m.add(tf.layers.batchNormalization());
    m.add(tf.layers.activation({ activation: 'relu' }));
    m.add(tf.layers.maxPooling2d({ poolSize: 2 }));
  });
  m.add(tf.layers.globalAveragePooling2d({}));
  m.add(tf.layers.dropout({ rate: 0.3, seed }));
  m.add(tf.layers.dense({ units: k, activation: 'softmax', kernelInitializer: tf.initializers.glorotUniform({ seed: seed + 9 }) }));
  return m;
}

/** Weights in LAYER order (getWeights() puts trainable first, so its order changes when layers are frozen). */
const layerWeights = (m: TF.LayersModel) => m.layers.flatMap((l) => l.getWeights());
function setLayerWeights(m: TF.LayersModel, ws: TF.Tensor[]) {
  let k = 0;
  for (const l of m.layers) { const n = l.getWeights().length; if (n) { l.setWeights(ws.slice(k, k + n)); k += n; } }
}
const flatWeights = (m: TF.LayersModel) => layerWeights(m).map((w) => ({ shape: w.shape, data: Array.from(w.dataSync()) }));

/**
 * Image classification. Modes:
 *  head      — frozen pretrained backbone → embeddings (+ flipped copies) → softmax head (fast)
 *  finetune  — backbone with its last `unfreeze` weighted layers trainable + head, on-the-fly augmentation
 *  scratch   — small CNN trained from random initialisation
 */
export async function trainImageTask(input: TrainImageInput, ctx: TaskContext): Promise<TrainImageOutput> {
  const t0 = performance.now();
  const tf = ctx.engine<Tf>('tfjs');
  const rng = new Rng(input.seed);
  const idx: number[] = [];
  input.labels.forEach((l, i) => { if (l !== null) idx.push(i); });
  const classes = [...new Set(idx.map((i) => input.labels[i]!))].sort();
  if (classes.length < 2) throw new Error('Need at least 2 labelled classes');
  const y = Int32Array.from(idx, (i) => classes.indexOf(input.labels[i]!));
  const sp = holdoutSplit(idx.length, rng.fork('split'), { validFraction: input.validFraction, stratify: y });
  const bb = input.mode === 'scratch' ? null : ctx.engine<Backbone>(input.backbone as EngineName);
  const size = bb ? bb.size : input.imageSize;
  const k = classes.length;

  ctx.progress({ fraction: 0.02, message: 'decode' });
  const imgs: Uint8Array[] = [];
  for (const [n, i] of idx.entries()) { imgs.push(await decodeRGB(input.pack.data[i], size)); if (n % 25 === 0) { ctx.progress({ fraction: 0.02 + 0.13 * (n / idx.length), message: 'decode' }); await ctx.checkpoint(); } }
  const tr = Array.from(sp.train), va = Array.from(sp.valid);
  const history: Record<string, number[]> = { epoch: [], loss: [], val_loss: [] };
  const bs = input.batchSize;
  let predictValid: () => Float32Array;
  let artifact: ImageModelArtifact;
  const restore: TF.Tensor[] = [];

  const fitLoop = async (model: TF.LayersModel, trainBatch: (ids: number[], ep: number) => TF.Tensor, validX: () => TF.Tensor, lo: number) => {
    const yv = tf.oneHot(tf.tensor1d(va.map((i) => y[i]), 'int32'), k);
    let best = { loss: Infinity, w: [] as TF.Tensor[] }, since = 0;
    try {
      for (let ep = 1; ep <= input.epochs; ep++) {
        const order = rng.fork(`ep${ep}`).shuffle([...tr]);
        let sum = 0;
        for (let b = 0; b < order.length; b += bs) {
          const ids = order.slice(b, b + bs);
          const xb = trainBatch(ids, ep), yb = tf.oneHot(tf.tensor1d(ids.map((i) => y[i]), 'int32'), k);
          const l = await model.trainOnBatch(xb, yb);
          sum += (Array.isArray(l) ? l[0] : l) * ids.length;
          tf.dispose([xb, yb]);
          await ctx.checkpoint();
        }
        const vx = validX();
        const ev = model.evaluate(vx, yv, { batchSize: bs }) as TF.Scalar;
        const vl = (await ev.data())[0];
        tf.dispose([vx, ev]);
        const loss = sum / tr.length;
        history.epoch.push(ep); history.loss.push(loss); history.val_loss.push(vl);
        ctx.progress({ fraction: lo + (1 - lo - 0.05) * (ep / input.epochs), point: { epoch: ep, loss, val_loss: vl } });
        if (vl < best.loss - 1e-6) { tf.dispose(best.w); best = { loss: vl, w: layerWeights(model).map((w) => w.clone()) }; since = 0; }
        else if (input.patience > 0 && ++since >= input.patience) break;
      }
      if (best.w.length) setLayerWeights(model, best.w);
    } finally {
      tf.dispose([yv, ...best.w]);
    }
  };

  if (input.mode === 'head') {
    // embeddings once (train: original + horizontally flipped copies)
    const embed = async (ids: number[], flip: boolean) => {
      const out: number[][] = [];
      for (let b = 0; b < ids.length; b += 32) {
        const e = tf.tidy(() => { let x = batchTensor(tf, ids.slice(b, b + 32).map((i) => imgs[i]), size, null, rng); if (flip) x = tf.image.flipLeftRight(x); return bb!.embed.predict(x) as TF.Tensor2D; });
        out.push(...(e.arraySync() as number[][])); e.dispose();
        ctx.progress({ fraction: 0.15 + 0.35 * ((b + 32) / ids.length) * (flip ? 0.5 : 0.5), message: 'embed' });
        await ctx.checkpoint();
      }
      return out;
    };
    const etr = await embed(tr, false), etrF = input.augment.flip ? await embed(tr, true) : [];
    const eva = await embed(va, false);
    const d = etr[0].length;
    const head = tf.sequential();
    head.add(tf.layers.dropout({ rate: 0.2, inputShape: [d], seed: input.seed }));
    head.add(tf.layers.dense({ units: k, activation: 'softmax', kernelInitializer: tf.initializers.glorotUniform({ seed: input.seed }) }));
    head.compile({ optimizer: tf.train.adam(input.learningRate), loss: 'categoricalCrossentropy' });
    const all = [...etr, ...etrF], ids = [...tr, ...(etrF.length ? tr : [])];
    const pos = new Map<number, number[]>(); // image index → rows in `all`
    ids.forEach((im, r) => { if (!pos.has(im)) pos.set(im, []); pos.get(im)!.push(r); });
    const rowsFor = (imIds: number[]) => imIds.map((im) => { const rs = pos.get(im)!; return all[rs[rng.int(rs.length)]]; });
    await fitLoop(head, (b) => tf.tensor2d(rowsFor(b)), () => tf.tensor2d(eva), 0.5);
    predictValid = () => { const p = head.predict(tf.tensor2d(eva)) as TF.Tensor; const a = p.dataSync() as Float32Array; p.dispose(); return a; };
    artifact = { kind: 'image', mode: 'head', backbone: input.backbone, size, classes, weights: flatWeights(head), embedDim: d };
  } else {
    let model: TF.LayersModel;
    if (input.mode === 'finetune') {
      // keep pristine backbone weights so the shared engine model is restored afterwards
      restore.push(...layerWeights(bb!.model).map((w) => w.clone()));
      const weighted = bb!.embed.layers.filter((l) => l.getWeights().length > 0);
      bb!.embed.layers.forEach((l) => { l.trainable = false; });
      weighted.slice(-Math.max(1, input.unfreeze)).forEach((l) => { l.trainable = true; });
      const headLayer = tf.layers.dense({ units: k, activation: 'softmax', kernelInitializer: tf.initializers.glorotUniform({ seed: input.seed }) });
      model = tf.model({ inputs: bb!.embed.inputs, outputs: headLayer.apply(tf.layers.dropout({ rate: 0.2, seed: input.seed }).apply(bb!.embed.outputs[0])) as TF.SymbolicTensor });
    } else model = scratchCnn(tf, size, k, input.seed);
    model.compile({ optimizer: tf.train.adam(input.learningRate), loss: 'categoricalCrossentropy' });
    try {
      await fitLoop(model, (b, ep) => batchTensor(tf, b.map((i) => imgs[i]), size, input.augment, rng.fork(`aug${ep}-${b[0]}`)), () => batchTensor(tf, va.map((i) => imgs[i]), size, null, rng), 0.15);
      const vx = batchTensor(tf, va.map((i) => imgs[i]), size, null, rng);
      const p = model.predict(vx, { batchSize: bs }) as TF.Tensor;
      const pv = p.dataSync() as Float32Array;
      tf.dispose([vx, p]);
      predictValid = () => pv;
      artifact = { kind: 'image', mode: input.mode, backbone: input.mode === 'scratch' ? 'scratch' : input.backbone, size, classes, weights: flatWeights(model), unfreeze: input.unfreeze };
    } finally {
      if (input.mode === 'finetune') { bb!.embed.layers.forEach((l) => { l.trainable = true; }); setLayerWeights(bb!.model, restore); tf.dispose(restore); }
    }
  }
  // latency per image (single-image inference, end to end)
  const one = batchTensor(tf, [imgs[va[0] ?? tr[0]]], size, null, rng);
  let latencyMs = 0;
  for (let rep = 0; rep < 3; rep++) { // first call compiles kernels → report the warm latency
    const tl = performance.now();
    const o = (bb ? bb.embed.predict(one) : one) as TF.Tensor;
    await o.data();
    o.dispose();
    latencyMs = performance.now() - tl;
  }
  one.dispose();
  const P = predictValid();
  const yv = Float64Array.from(va.map((i) => y[i]));
  const res = classificationMetrics(yv, { rows: va.length, cols: k, data: Float64Array.from(P) });
  return {
    metrics: res.metrics, confusion: confusionMatrix(yv, res.pred, k), classes, history, latencyMs,
    nTrain: tr.length, nValid: va.length, artifact, durationMs: performance.now() - t0,
  };
}

/** Classify images with a stored image model. */
export async function predictImageTask(input: PredictImageInput, ctx: TaskContext): Promise<{ proba: number[][] }> {
  const tf = ctx.engine<Tf>('tfjs');
  const a = input.artifact;
  const bb = a.backbone === 'scratch' ? null : ctx.engine<Backbone>(a.backbone as EngineName);
  const rng = new Rng(0);
  const imgs = await Promise.all(input.images.map((b) => decodeRGB(b, a.size)));
  const toWeights = () => a.weights.map((w) => tf.tensor(w.data, w.shape));
  let model: TF.LayersModel;
  let restore: TF.Tensor[] = [];
  if (a.mode === 'head') {
    model = tf.sequential({ layers: [tf.layers.dropout({ rate: 0.2, inputShape: [a.embedDim!] }), tf.layers.dense({ units: a.classes.length, activation: 'softmax' })] });
  } else if (a.mode === 'finetune') {
    restore = layerWeights(bb!.model).map((w) => w.clone());
    model = tf.model({ inputs: bb!.embed.inputs, outputs: tf.layers.dense({ units: a.classes.length, activation: 'softmax' }).apply(tf.layers.dropout({ rate: 0.2 }).apply(bb!.embed.outputs[0])) as TF.SymbolicTensor });
  } else model = scratchCnn(tf, a.size, a.classes.length, 0);
  const ws = toWeights();
  setLayerWeights(model, ws);
  try {
    const x = batchTensor(tf, imgs, a.size, null, rng);
    const feats = a.mode === 'head' ? (bb!.embed.predict(x) as TF.Tensor) : x;
    const p = model.predict(feats) as TF.Tensor;
    const proba = p.arraySync() as number[][];
    tf.dispose([x, feats, p]);
    return { proba };
  } finally {
    tf.dispose(ws);
    if (restore.length) { setLayerWeights(bb!.model, restore); tf.dispose(restore); }
  }
}
