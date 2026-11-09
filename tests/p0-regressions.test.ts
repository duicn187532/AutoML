import { describe, expect, it } from 'vitest';
import { type ColumnarTable } from '@/core/data/table';
import { DEFAULT_PREPROCESS, fitPreprocessor, transform, transformTraining, type TargetState } from '@/core/ml/preprocess';
import { holdoutSplit, kFold } from '@/core/ml/split';
import { rmse } from '@/core/ml/metrics';
import { Rng } from '@/core/rng';
import { encodeBinJson, decodeBinJson } from '@/core/storage/binjson';
import type { ModelArtifact } from '@/core/models/types';
import { autoTask } from '@/core/workers/tasks/auto';
import { predictTask } from '@/core/workers/tasks/predict';
import { exportPortableTask } from '@/core/workers/tasks/exportPortable';
import { trainTask } from '@/core/workers/tasks/train';
import { amlPredict } from '@/core/export/runtime.js';
import { config, testCtx } from './helpers';

const regressionTarget = (mean: number, std: number): TargetState => ({ task: 'regression', column: 'y', mean, std });

describe('P0: cross-fitted target encoding', () => {
  it('excludes a training row own target even when category occurs only once', () => {
    const n = 30;
    const table: ColumnarTable = {
      rowCount: n,
      columns: [
        { name: 'category', kind: 'categorical', values: Array.from({ length: n }, (_, i) => 'only-' + i) },
        { name: 'y', kind: 'numeric', values: Float64Array.from({ length: n }, (_, i) => i) },
      ],
    };
    const idx = Int32Array.from({ length: n }, (_, i) => i);
    const y = Float64Array.from({ length: n }, (_, i) => i);
    const changed = Float64Array.from(y);
    changed[0] = 10_000;
    const cfg = { ...DEFAULT_PREPROCESS, categoricalEncoding: 'target' as const };
    const originalPrep = fitPreprocessor(table, ['category'], idx, cfg, { y, nClasses: 0 });
    const changedPrep = fitPreprocessor(table, ['category'], idx, cfg, { y: changed, nClasses: 0 });
    const before = transformTraining(originalPrep, table, idx, { y, nClasses: 0 }, new Rng(19));
    const after = transformTraining(changedPrep, table, idx, { y: changed, nClasses: 0 }, new Rng(19));
    expect(before.cols).toBe(1);
    expect(before.data[0]).toBeCloseTo(after.data[0], 12);
    expect(transform(originalPrep, table, idx).data[0]).not.toBeCloseTo(transform(changedPrep, table, idx).data[0], 5);

    const folds = kFold(n, 5, new Rng(19));
    const fold = folds.find((f) => Array.from(f.valid).includes(0))!;
    const expected = Array.from(fold.train, (i) => y[i]).reduce((a, b) => a + b, 0) / fold.train.length;
    expect(before.data[0]).toBeCloseTo(expected, 12);
    expect(Array.from(before.data)).toEqual(Array.from(transformTraining(originalPrep, table, idx, { y, nClasses: 0 }, new Rng(19)).data));
  });

  it('is actually used by ridge training and avoids memorising unique high-cardinality categories', async () => {
    const n = 80;
    const table: ColumnarTable = {
      rowCount: n,
      columns: [
        { name: 'category', kind: 'categorical', values: Array.from({ length: n }, (_, i) => 'unique-' + i) },
        { name: 'y', kind: 'numeric', values: Float64Array.from({ length: n }, (_, i) => (i % 2) * 100) },
      ],
    };
    const out = await trainTask({
      table,
      config: config({
        task: 'regression', target: 'y', features: ['category'], pluginId: 'ridge', params: { alpha: 0.01 },
        preprocess: { ...DEFAULT_PREPROCESS, categoricalEncoding: 'target' },
      }),
    }, testCtx());
    expect(out.preprocessor.steps[0].type).toBe('target');
    expect(out.metrics.train.r2!).toBeLessThan(0.8);
    expect(Number.isFinite(out.metrics.valid.rmse!)).toBe(true);
  });
});

describe('P0: regression bagging must restore each fold own target units before averaging', () => {
  const table: ColumnarTable = {
    rowCount: 3,
    columns: [{ name: 'x', kind: 'numeric', values: Float64Array.from([1, 2, 3]) }],
  };
  const prep = fitPreprocessor(table, ['x'], Int32Array.of(0, 1, 2));
  const artifact = (bias: number): ModelArtifact => ({
    pluginId: 'ridge', pluginVersion: 1, task: 'regression', nFeatures: 1, nClasses: 0, params: { alpha: 1 },
    payload: { w: [0], b: bias },
  });
  const bundle = encodeBinJson({
    kind: 'bagged-ensemble', task: 'regression', target: regressionTarget(999, 999),
    members: [{
      pluginId: 'ridge', params: { alpha: 1 }, weight: 1, folds: [
        { preprocessor: prep, artifact: artifact(1), target: regressionTarget(10, 2) },
        { preprocessor: prep, artifact: artifact(1), target: regressionTarget(100, 10) },
      ],
    }],
  });

  it('saved ensemble and portable HTML/JS runtime agree on original-unit predictions', async () => {
    const original = await predictTask({ table, model: bundle }, testCtx());
    const portable = await exportPortableTask({ model: bundle }, testCtx());
    const expected = ((1 * 2 + 10) + (1 * 10 + 100)) / 2;
    for (let i = 0; i < table.rowCount; i++) {
      expect(original.prediction[i]).toBeCloseTo(expected, 12);
      expect(amlPredict(portable, { x: i + 1 }).value).toBeCloseTo(expected, 12);
    }
    expect(portable.members.map((m) => m.targetScale?.mean)).toEqual([10, 100]);
  });

  it('does not change single-model regression predictions', async () => {
    const single = encodeBinJson({ artifact: artifact(1), preprocessor: prep, target: regressionTarget(10, 2) });
    const prediction = await predictTask({ table, model: single }, testCtx());
    const portable = await exportPortableTask({ model: single }, testCtx());
    expect(prediction.prediction).toEqual([12, 12, 12]);
    expect(amlPredict(portable, { x: 2 }).value).toBe(12);
  });

  it('integrates AutoML training, saved prediction, independent test score and portable export', async () => {
    const n = 45, seed = 37;
    const dataset: ColumnarTable = {
      rowCount: n,
      columns: [
        { name: 'x', kind: 'numeric', values: Float64Array.from({ length: n }, (_, i) => i - 22) },
        { name: 'y', kind: 'numeric', values: Float64Array.from({ length: n }, (_, i) => 1000 + 40 * i + 8 * (i % 5)) },
      ],
    };
    // The fast portfolio includes Python models; without an engine they are skipped,
    // leaving a pure-TS Ridge candidate for deterministic integration coverage.
    const out = await autoTask({
      table: dataset, target: 'y', features: ['x'], task: 'regression', preset: 'fast',
      seed, folds: 3, timeBudgetSec: 30, testFraction: 0.2,
    }, testCtx());
    const model = decodeBinJson<{ members: { folds: { target?: TargetState }[] }[] }>(out.bundle);
    expect(model.members.length).toBeGreaterThan(0);
    expect(model.members[0].folds).toHaveLength(3);
    expect(model.members[0].folds.every((f) => f.target?.task === 'regression')).toBe(true);
    const live = await predictTask({ table: dataset, model: out.bundle }, testCtx());
    const testRows = holdoutSplit(n, new Rng(seed).fork('outer'), { validFraction: 0, testFraction: 0.2 }).test;
    const y = dataset.columns[1].values as Float64Array;
    const actualRmse = rmse(Array.from(testRows, (i) => y[i]), Array.from(testRows, (i) => Number(live.prediction[i])));
    expect(actualRmse).toBeCloseTo(out.ensemble.test!.rmse!, 7);
    const portable = await exportPortableTask({ model: out.bundle }, testCtx());
    for (const i of testRows) {
      expect(amlPredict(portable, { x: i - 22 }).value).toBeCloseTo(Number(live.prediction[i]), 8);
    }
  });
});
