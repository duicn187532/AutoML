import type * as TF from '@tensorflow/tfjs';
import type { Matrix } from '../../ml/matrix';
import { Rng } from '../../rng';
import type { TaskContext } from '../types';

type Tf = typeof TF;

/** LSTM / GRU / TCN one-step forecaster on a standardised series; multi-step by recursion. */
export async function neuralForecast(tf: Tf, y: Float64Array, method: 'lstm' | 'gru' | 'tcn', p: Record<string, number | string>, horizon: number, holdout: number, ctx: TaskContext) {
  const L = Math.max(4, Number(p.window ?? 24)), units = Number(p.units ?? 32), epochs = Number(p.epochs ?? 60);
  const fit = async (series: Float64Array, steps: number) => {
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    const std = Math.sqrt(series.reduce((a, b) => a + (b - mean) ** 2, 0) / series.length) || 1;
    const z = Array.from(series, (v) => (v - mean) / std);
    const n = z.length - L;
    if (n < 8) throw new Error(`Series too short for window ${L}`);
    const X = new Float32Array(n * L), Y = new Float32Array(n);
    for (let i = 0; i < n; i++) { for (let j = 0; j < L; j++) X[i * L + j] = z[i + j]; Y[i] = z[i + L]; }
    const seed = 7;
    const m = tf.sequential();
    if (method === 'tcn') {
      // causal dilated convolutions (dilation 1, 2, 4) + global pooling of the last step
      [1, 2, 4].forEach((d, i) => m.add(tf.layers.conv1d({ filters: units, kernelSize: 3, dilationRate: d, padding: 'causal', activation: 'relu', inputShape: i === 0 ? [L, 1] : undefined, kernelInitializer: tf.initializers.heNormal({ seed: seed + i }) })));
      m.add(tf.layers.globalAveragePooling1d({}));
    } else {
      const rnn = method === 'lstm' ? tf.layers.lstm : tf.layers.gru;
      m.add(rnn({ units, inputShape: [L, 1], kernelInitializer: tf.initializers.glorotUniform({ seed }), recurrentInitializer: tf.initializers.orthogonal({ seed: seed + 1 }) }));
    }
    m.add(tf.layers.dense({ units: 1, kernelInitializer: tf.initializers.glorotUniform({ seed: seed + 9 }) }));
    m.compile({ optimizer: tf.train.adam(Number(p.learningRate ?? 0.005)), loss: 'meanSquaredError' });
    const xs = tf.tensor3d(X, [n, L, 1]), ys = tf.tensor2d(Y, [n, 1]);
    const rng = new Rng(seed);
    for (let ep = 0; ep < epochs; ep++) {
      const perm = tf.tensor1d(rng.permutation(n), 'int32');
      const bx = tf.gather(xs, perm), by = tf.gather(ys, perm);
      await m.fit(bx, by, { epochs: 1, batchSize: 32, shuffle: false, verbose: 0 });
      tf.dispose([perm, bx, by]);
      ctx.progress({ fraction: (ep + 1) / epochs });
      await ctx.checkpoint();
    }
    // residual std for intervals
    const fitted = m.predict(xs) as TF.Tensor;
    const res = (fitted.dataSync() as Float32Array).map((v, i) => v - Y[i]);
    const sd = Math.sqrt(res.reduce((a, b) => a + b * b, 0) / res.length) * std;
    tf.dispose([xs, ys, fitted]);
    const hist = z.slice(-L), pred: number[] = [];
    for (let s = 0; s < steps; s++) {
      const o = m.predict(tf.tensor3d(Float32Array.from(hist.slice(-L)), [1, L, 1])) as TF.Tensor;
      const v = (o.dataSync() as Float32Array)[0];
      o.dispose();
      hist.push(v);
      pred.push(v * std + mean);
    }
    m.dispose();
    const lo = pred.map((v, i) => v - 1.96 * sd * Math.sqrt(i + 1)), hi = pred.map((v, i) => v + 1.96 * sd * Math.sqrt(i + 1));
    return { pred, lo, hi };
  };
  let hold;
  if (holdout > 0 && y.length - holdout > L + 8) {
    const r = await fit(y.subarray(0, y.length - holdout), holdout);
    const actual = Array.from(y.subarray(y.length - holdout));
    const err = actual.map((a, i) => a - r.pred[i]);
    hold = { ...r, mae: err.reduce((a, b) => a + Math.abs(b), 0) / err.length, rmse: Math.sqrt(err.reduce((a, b) => a + b * b, 0) / err.length), mape: err.reduce((a, e, i) => a + Math.abs(e) / Math.max(Math.abs(actual[i]), 1e-12), 0) / err.length };
  }
  return { holdout: hold, forecast: await fit(y, horizon), aic: NaN };
}

/** Dense autoencoder: 2-D bottleneck embedding + reconstruction error as anomaly score. */
export async function autoencoder(tf: Tf, X: Matrix, p: Record<string, number | string>, seed: number, ctx: TaskContext) {
  const hidden = Number(p.hidden ?? 32), contamination = Number(p.contamination ?? 0.05);
  // small datasets: guarantee ≥ ~2000 optimiser steps
  const epochs = Math.max(Number(p.epochs ?? 80), Math.ceil(2000 / Math.ceil(X.rows / 64)));
  const inp = tf.input({ shape: [X.cols] });
  const h1 = tf.layers.dense({ units: hidden, activation: 'relu', kernelInitializer: tf.initializers.glorotUniform({ seed }) }).apply(inp) as TF.SymbolicTensor;
  const code = tf.layers.dense({ units: 2, kernelInitializer: tf.initializers.glorotUniform({ seed: seed + 1 }), name: 'code' }).apply(h1) as TF.SymbolicTensor;
  const h2 = tf.layers.dense({ units: hidden, activation: 'relu', kernelInitializer: tf.initializers.glorotUniform({ seed: seed + 2 }) }).apply(code) as TF.SymbolicTensor;
  const out = tf.layers.dense({ units: X.cols, kernelInitializer: tf.initializers.glorotUniform({ seed: seed + 3 }) }).apply(h2) as TF.SymbolicTensor;
  const ae = tf.model({ inputs: inp, outputs: out }), enc = tf.model({ inputs: inp, outputs: code });
  ae.compile({ optimizer: tf.train.adam(0.003), loss: 'meanSquaredError' });
  const xs = tf.tensor2d(Float32Array.from(X.data), [X.rows, X.cols]);
  const rng = new Rng(seed);
  for (let ep = 0; ep < epochs; ep++) {
    const perm = tf.tensor1d(rng.permutation(X.rows), 'int32');
    const b = tf.gather(xs, perm);
    await ae.fit(b, b, { epochs: 1, batchSize: 64, shuffle: false, verbose: 0 });
    tf.dispose([perm, b]);
    ctx.progress({ fraction: (ep + 1) / epochs });
    await ctx.checkpoint();
  }
  const rec = ae.predict(xs) as TF.Tensor, emb = enc.predict(xs) as TF.Tensor;
  const scores = (tf.tidy(() => tf.mean(tf.square(tf.sub(rec, xs)), 1)).dataSync() as Float32Array);
  const sorted = Array.from(scores).sort((a, b) => b - a);
  const cut = sorted[Math.max(0, Math.floor(contamination * scores.length) - 1)] ?? Infinity;
  const embedding = Array.from(emb.dataSync() as Float32Array);
  tf.dispose([xs, rec, emb]);
  ae.dispose();
  return { scores: Array.from(scores), anomaly: Array.from(scores, (s) => (s >= cut ? 1 : 0)), embedding };
}
