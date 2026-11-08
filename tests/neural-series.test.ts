import * as tf from '@tensorflow/tfjs';
import { describe, expect, it } from 'vitest';
import { autoencoder, neuralForecast } from '@/core/workers/tasks/neuralSeries';
import { testCtx } from './helpers';
import { Rng } from '@/core/rng';

describe('sequence models / autoencoder (TF.js CPU)', () => {
  it('LSTM learns a seasonal series better than a flat forecast', { timeout: 60_000 }, async () => {
    await tf.setBackend('cpu');
    const y = Float64Array.from({ length: 160 }, (_, i) => 10 + 3 * Math.sin((2 * Math.PI * i) / 12));
    const r = await neuralForecast(tf, y, 'lstm', { window: 24, units: 16, epochs: 40 }, 12, 12, testCtx());
    const flatRmse = Math.sqrt(y.slice(-12).reduce((a, v) => a + (v - 10) ** 2, 0) / 12);
    expect(r.holdout!.rmse).toBeLessThan(flatRmse * 0.6);
    expect(r.forecast.pred).toHaveLength(12);
  });
  it('autoencoder ranks off-manifold points highest', { timeout: 60_000 }, async () => {
    const rng = new Rng(3), rows = 400, cols = 6, data = new Float64Array(rows * cols);
    for (let i = 0; i < rows; i++) {
      const a = rng.normal(), b = rng.normal();
      for (let j = 0; j < cols; j++) data[i * cols + j] = a * Math.cos(j) + b * Math.sin(j) + 0.05 * rng.normal();
    }
    const odd = [5, 120, 333];
    // directions orthogonal to the manifold span{cos j, sin j} (Gram–Schmidt)
    const basis = [Array.from({ length: cols }, (_, j) => Math.cos(j)), Array.from({ length: cols }, (_, j) => Math.sin(j))];
    const dot = (u: number[], v: number[]) => u.reduce((acc, x, k) => acc + x * v[k], 0);
    const q1 = basis[0].map((x) => x / Math.sqrt(dot(basis[0], basis[0])));
    const t2 = basis[1].map((x, k) => x - dot(basis[1], q1) * q1[k]);
    const q2 = t2.map((x) => x / Math.sqrt(dot(t2, t2)));
    odd.forEach((i, n) => {
      const v = Array.from({ length: cols }, (_, j) => ((j + n) % 3) - 1);
      const w = v.map((x, k) => x - dot(v, q1) * q1[k] - dot(v, q2) * q2[k]);
      const norm = Math.sqrt(dot(w, w));
      for (let j = 0; j < cols; j++) data[i * cols + j] = (3 * w[j]) / norm;
    });
    const r = await autoencoder(tf, { rows, cols, data }, { contamination: 0.01 }, 1, testCtx());
    const top = r.scores.map((sc, i) => [sc, i]).sort((x, y) => y[0] - x[0]).slice(0, 3).map((x) => x[1]).sort((x, y) => x - y);
    expect(top).toEqual(odd);
  });
});
