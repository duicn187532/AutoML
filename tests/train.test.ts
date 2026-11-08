import * as tf from '@tensorflow/tfjs';
import { describe, expect, it } from 'vitest';
import { choleskySolve } from '@/core/models/builtin/ridge';
import { defaultParams, validateParams } from '@/core/models/params';
import { getPlugin, listPlugins } from '@/core/models/registry';
import { trainTask } from '@/core/workers/tasks/train';
import { config, loadSample, testCtx } from './helpers';

const cls = loadSample('collateral-classification.csv');
const reg = loadSample('collateral-regression.csv');
const clsFeatures = cls.columns.slice(0, -1).map((c) => c.name);
const regFeatures = ['地段', '屋況', '臥室數', '浴室數', '客廳面積', '土地面積', '車位數', '供暖系統'];

describe('plugin registry & params', () => {
  it('lists plugins per task and validates params against the schema', () => {
    const reg = listPlugins('regression').map((p) => p.id), cls = listPlugins('multiclass').map((p) => p.id);
    expect(reg).toEqual(expect.arrayContaining(['ridge', 'mlp', 'xgboost', 'lightgbm', 'random_forest']));
    expect(reg).not.toContain('logistic');
    expect(cls).toEqual(expect.arrayContaining(['logistic', 'mlp', 'naive_bayes', 'lda']));
    expect(cls).not.toContain('ridge');
    const lp = getPlugin('logistic');
    const { params, errors } = validateParams(lp.params, { ...defaultParams(lp), epochs: 1e9, learningRate: 'abc', junk: 1 });
    expect(params.epochs).toBe(5000);
    expect(params.learningRate).toBe(0.05);
    expect(params).not.toHaveProperty('junk');
    expect(errors.map((e) => e.key).sort()).toEqual(['epochs', 'learningRate']);
  });

  it('cholesky solves an SPD system', () => {
    const x = choleskySolve(Float64Array.from([4, 2, 2, 3]), Float64Array.from([2, 1]), 2);
    expect(x[0]).toBeCloseTo(0.5);
    expect(x[1]).toBeCloseTo(0);
  });
});

describe('train task', () => {
  it('logistic regression learns the classification sample and is reproducible', async () => {
    const cfg = config({ target: '價位區間', features: clsFeatures, pluginId: 'logistic', params: defaultParams(getPlugin('logistic')), seed: 11 });
    const points: Record<string, number>[] = [];
    const a = await trainTask({ table: cls, config: cfg }, testCtx({}, (p) => points.push(p)));
    expect(a.task).toBe('multiclass');
    expect(a.metrics.valid.accuracy).toBeGreaterThan(0.75);
    expect(a.metrics.valid.auc).toBeGreaterThan(0.8);
    expect(points.length).toBeGreaterThan(3);
    expect(a.confusion!.flat().reduce((x, y) => x + y)).toBe(a.nValid);
    const b = await trainTask({ table: cls, config: cfg }, testCtx());
    expect(b.metrics).toEqual(a.metrics); // same seed ⇒ identical result
    const c = await trainTask({ table: cls, config: { ...cfg, seed: 12 } }, testCtx());
    expect(c.metrics).not.toEqual(a.metrics);
  });

  it('model artifact reloads and reproduces predictions', async () => {
    const cfg = config({ target: '價位區間', features: clsFeatures, pluginId: 'logistic', params: { ...defaultParams(getPlugin('logistic')), epochs: 20 } });
    const out = await trainTask({ table: cls, config: cfg }, testCtx());
    const m = await getPlugin('logistic').load(out.artifact, { task: out.task, nFeatures: out.artifact.nFeatures, nClasses: out.artifact.nClasses, engine: () => { throw new Error(); } });
    const X = { rows: 1, cols: out.artifact.nFeatures, data: new Float64Array(out.artifact.nFeatures) };
    const P = m.predictProba!(X);
    expect(P.data.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('ridge regression reports metrics in original units', async () => {
    const out = await trainTask({ table: reg, config: config({ target: '價位', features: regFeatures, pluginId: 'ridge', params: { alpha: 1 } }) }, testCtx());
    expect(out.task).toBe('regression');
    expect(out.metrics.valid.r2).toBeGreaterThan(0.5);
    expect(out.metrics.valid.rmse).toBeGreaterThan(1000); // prices, not standardised units
  });

  it('rejects incompatible plugin/task combinations', async () => {
    await expect(trainTask({ table: reg, config: config({ target: '價位', features: regFeatures, pluginId: 'logistic' }) }, testCtx())).rejects.toThrow(/does not support/);
  });

  it('stops at a checkpoint when cancelled', async () => {
    const ctx = testCtx() as ReturnType<typeof testCtx> & { cancel(): void };
    ctx.cancel();
    await expect(trainTask({ table: cls, config: config({ target: '價位區間', features: clsFeatures }) }, ctx)).rejects.toThrow('Cancelled');
  });

  it('MLP (tfjs engine) trains and its artifact reloads', { timeout: 60_000 }, async () => {
    await tf.setBackend('cpu');
    const p = { ...defaultParams(getPlugin('mlp')), epochs: 80, units: 32, hiddenLayers: 1, patience: 0 };
    const out = await trainTask({ table: cls, config: config({ target: '價位區間', features: clsFeatures, pluginId: 'mlp', params: p, seed: 3 }) }, testCtx({ tfjs: tf }));
    expect(out.metrics.valid.accuracy).toBeGreaterThan(0.6);
    expect(out.history.epoch.length).toBe(80);
    const m = await getPlugin('mlp').load(out.artifact, { task: out.task, nFeatures: out.artifact.nFeatures, nClasses: out.artifact.nClasses, engine: <T,>() => tf as T });
    const P = m.predictProba!({ rows: 2, cols: out.artifact.nFeatures, data: new Float64Array(2 * out.artifact.nFeatures) });
    expect(P.rows).toBe(2);
    expect(P.cols).toBe(out.artifact.nClasses);
    expect(P.data.subarray(0, P.cols).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4);
  });
});
