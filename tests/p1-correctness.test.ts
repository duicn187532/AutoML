import * as tf from '@tensorflow/tfjs';
import { describe, expect, it } from 'vitest';
import { parseTimeValue, timeSplit, kFold } from '@/core/ml/split';
import { prepareExpertFold, toOuterTargetScale } from '@/core/ml/expertFold';
import { fitPreprocessor, fitTarget } from '@/core/ml/preprocess';
import type { ColumnarTable } from '@/core/data/table';
import { template } from '@/core/dag/graph';
import { trainGraphTask } from '@/core/workers/tasks/trainGraph';
import { trainTask } from '@/core/workers/tasks/train';
import { Rng } from '@/core/rng';
import { config, testCtx } from './helpers';

describe('P1: chronological splits', () => {
  it('sorts calendar dates, not their non-zero-padded source strings', () => {
    const raw = ['2024-10-10', '2024-2-1', '2024-12-20', '2024-1-1', '2024-3-1', '2024-11-3', '2024-4-1', '2024-6-2'];
    const sp = timeSplit(raw.map(parseTimeValue), { validFraction: 0.25, testFraction: 0.25 });
    expect(Array.from(sp.train)).toEqual([1, 3, 4, 6]);
    expect(Array.from(sp.valid)).toEqual([0, 7]);
    expect(Array.from(sp.test)).toEqual([2, 5]);
  });

  it('normalises UTC offsets and checks impossible calendar dates', () => {
    expect(parseTimeValue('2024-02-29')).toBe(Date.UTC(2024, 1, 29));
    expect(parseTimeValue('2024-01-01T08:00:00+08:00')).toBe(parseTimeValue('2024-01-01T00:00:00Z'));
    expect(parseTimeValue('2024/2/1')).toBe(Date.UTC(2024, 1, 1));
    for (const s of ['2024-02-30', '2023-02-29', '2024-13-01', '2024-01-01T25:00:00', 'not a date', '']) {
      expect(() => parseTimeValue(s)).toThrow();
    }
    expect(() => parseTimeValue(NaN)).toThrow();
    expect(() => timeSplit([1, NaN, 3], { validFraction: 0.25 })).toThrow();
  });

  it('blocks identical timestamp values on either chronological partition boundary', () => {
    expect(() => timeSplit([1, 1, 2, 2], { validFraction: 0.25 })).toThrow(/identical timestamps/);
    expect(() => timeSplit([1, 2, 3, 3], { validFraction: 0, testFraction: 0.25 })).toThrow(/identical timestamps/);
    expect(() => timeSplit([1, 2, 3], { validFraction: -0.1 })).toThrow();
  });

  it('uses parsed timestamp ordering in the actual trainTask path', async () => {
    const raw = Array.from({ length: 30 }, (_, i) => '2024-' + (i % 12 + 1) + '-' + String(Math.floor(i / 12) + 1));
    const table: ColumnarTable = { rowCount: 30, columns: [
      { name: 'date', kind: 'datetime', values: raw },
      { name: 'x', kind: 'numeric', values: Float64Array.from({ length: 30 }, (_, i) => i) },
      { name: 'y', kind: 'numeric', values: Float64Array.from({ length: 30 }, (_, i) => i * 12 + 0.1 * i * i) },
    ] };
    const out = await trainTask({ table, config: config({
      target: 'y', task: 'regression', features: ['x'], pluginId: 'ridge', params: { alpha: 1 },
      split: { kind: 'time', column: 'date', validFraction: 0.2, testFraction: 0.2 },
    }) }, testCtx());
    expect(out.nTrain).toBe(18);
    expect(out.nValid).toBe(6);
    expect(out.nTest).toBe(6);
    expect(Number.isFinite(out.metrics.test?.rmse)).toBe(true);
    table.columns[0] = { name: 'date', kind: 'datetime', values: raw.map((s, i) => i === 4 ? 'garbage' : s) };
    await expect(trainTask({ table, config: config({
      target: 'y', task: 'regression', features: ['x'], pluginId: 'ridge', params: { alpha: 1 },
      split: { kind: 'time', column: 'date', validFraction: 0.2, testFraction: 0.2 },
    }) }, testCtx())).rejects.toThrow(/Unparseable/);
  });
});

describe('P1: inner-fold leakage isolation', () => {
  const n = 40;
  const table: ColumnarTable = { rowCount: n, columns: [
    { name: 'x', kind: 'numeric', values: Float64Array.from({ length: n }, (_, i) => i === 0 ? 99999 : i) },
    { name: 'c', kind: 'categorical', values: Array.from({ length: n }, (_, i) => i === 0 ? 'held-out-only' : i % 2 ? 'a' : 'b') },
    { name: 'y', kind: 'numeric', values: Float64Array.from({ length: n }, (_, i) => i === 0 ? 10000 : i * 3) },
  ] };
  const idx = Int32Array.from({ length: n }, (_, i) => i);
  const y = table.columns[2].values as Float64Array;
  const outer = fitTarget(table, 'y', 'regression', idx);

  it('inner validation outlier cannot change fold preprocessing, vocabulary or target scaling', () => {
    const fold = { train: Int32Array.from({ length: n - 1 }, (_, i) => i + 1), valid: Int32Array.of(0) };
    const part = prepareExpertFold(table, ['x', 'c'], idx, fold, 'y', y, outer);
    expect(part.trainRows.length).toBe(n - 1);
    expect(part.validRows[0]).toBe(0);
    const step = part.preprocessor.steps[0];
    if (step.type !== 'numeric') throw new Error('Expected numeric step');
    expect(step.center).toBeCloseTo(20, 8);
    const full = fitPreprocessor(table, ['x', 'c'], idx).steps[0];
    if (full.type !== 'numeric') throw new Error('Expected numeric step');
    expect(full.center).toBeGreaterThan(1000);
    const cats = part.preprocessor.steps[1];
    if (cats.type !== 'onehot') throw new Error('Expected onehot step');
    expect(cats.categories).not.toContain('held-out-only');
    if (part.target.task !== 'regression' || outer.task !== 'regression') throw new Error('Expected regression');
    expect(part.target.mean).toBeLessThan(100);
    expect(outer.mean).toBeGreaterThan(200);
    expect(part.ytrain.reduce((sum, v) => sum + v, 0)).toBeCloseTo(0, 10);
    expect(toOuterTargetScale(1, part.target, outer)).toBeCloseTo((part.target.mean + part.target.std - outer.mean) / outer.std, 10);
  });

  it('re-fits each of five OOF preprocessing pipelines independently', () => {
    const folds = kFold(n, 5, new Rng(44));
    for (const fold of folds) {
      const part = prepareExpertFold(table, ['x', 'c'], idx, fold, 'y', y, outer);
      expect(part.Xvalid.rows).toBe(fold.valid.length);
      expect(part.Xtrain.rows).toBe(fold.train.length);
      expect(part.Xtrain.cols).toBe(part.Xvalid.cols);
    }
  });

  it('runs a real heterogeneous MoE with fold-isolated Ridge experts', { timeout: 60_000 }, async () => {
    await tf.setBackend('cpu');
    const g = template('heteroMoe', ['y'], ['x']);
    for (const expert of g.nodes.filter((node) => node.type === 'expert')) expert.params.model = 'ridge';
    const out = await trainGraphTask({
      table, graph: g, features: ['x'], seed: 13, validFraction: 0.25,
      epochs: 2, batchSize: 16, learningRate: 0.01, patience: 0,
    }, testCtx({ tfjs: tf }));
    expect(out.mode).toBe('two-stage');
    expect(out.experts).toHaveLength(3);
    expect(Number.isFinite(out.metrics[out.heads[0].node].rmse!)).toBe(true);
    expect(out.notes.some((note) => note.includes('fold-local'))).toBe(true);
  });
});
