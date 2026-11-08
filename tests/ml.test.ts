import { describe, expect, it } from 'vitest';
import { inferTable } from '@/core/data/infer';
import {
  accuracy, classificationMetrics, confusionMatrix, logLoss, mae, mape, perClassReport, r2, rmse, rocAuc, rocAucOvr, rocCurve,
} from '@/core/ml/metrics';
import { encodeTarget, fitPreprocessor, fitTarget, inferTask, transform } from '@/core/ml/preprocess';
import { holdoutSplit, kFold } from '@/core/ml/split';
import { Rng } from '@/core/rng';

const M = (rows: number[][]) => ({ rows: rows.length, cols: rows[0].length, data: Float64Array.from(rows.flat()) });

// Reference values verified against scikit-learn 1.9.1.
describe('metrics match scikit-learn', () => {
  it('roc_auc_score', () => {
    expect(rocAuc([0, 0, 1, 1], [0.1, 0.4, 0.35, 0.8])).toBeCloseTo(0.75, 12);
    expect(rocAuc([0, 0, 1, 1, 1], [0.1, 0.5, 0.5, 0.9, 0.2])).toBeCloseTo(0.75, 12); // ties count 1/2
    expect(rocAuc([0, 1, 0, 1], [0.5, 0.5, 0.5, 0.5])).toBe(0.5);
    expect(rocAuc([1, 1], [0.2, 0.3])).toBeNaN();
  });

  it('roc_curve starts at (0,0) (legacy bug)', () => {
    const r = rocCurve([0, 0, 1, 1], [0.1, 0.4, 0.35, 0.8]);
    expect(r.fpr).toEqual([0, 0, 0.5, 0.5, 1]);
    expect(r.tpr).toEqual([0, 0.5, 0.5, 1, 1]);
    expect(r.thresholds).toEqual([Infinity, 0.8, 0.4, 0.35, 0.1]);
  });

  it('log_loss, accuracy, confusion, per-class', () => {
    expect(logLoss([0, 1, 1], M([[0.9, 0.1], [0.2, 0.8], [0.3, 0.7]]))).toBeCloseTo(0.2283930, 6);
    expect(accuracy([0, 1, 2, 2], [0, 2, 2, 2])).toBe(0.75);
    const cm = confusionMatrix([0, 1, 2, 2], [0, 2, 2, 2], 3);
    expect(cm).toEqual([[1, 0, 0], [0, 0, 1], [0, 0, 2]]);
    const pc = perClassReport(cm);
    expect(pc[2].precision).toBeCloseTo(2 / 3);
    expect(pc[2].recall).toBe(1);
    expect(pc[1].f1).toBe(0);
  });

  it('roc_auc_score multi_class=ovr macro', () => {
    const y = [0, 1, 2, 2, 1, 0];
    const P = M([[0.7, 0.2, 0.1], [0.3, 0.4, 0.3], [0.1, 0.2, 0.7], [0.2, 0.5, 0.3], [0.2, 0.6, 0.2], [0.4, 0.4, 0.2]]);
    const manual = [0, 1, 2].map((c) => rocAuc(y.map((v) => (v === c ? 1 : 0)), Array.from({ length: 6 }, (_, i) => P.data[i * 3 + c])));
    expect(rocAucOvr(y, P)).toBeCloseTo(manual.reduce((a, b) => a + b) / 3, 12);
    expect(rocAucOvr(y, P)).toBeCloseTo(0.9166666666666666, 10);
  });

  it('regression metrics', () => {
    const y = [3, -0.5, 2, 7], p = [2.5, 0.0, 2, 8];
    expect(r2(y, p)).toBeCloseTo(0.9486081370449679, 12);
    expect(mae(y, p)).toBeCloseTo(0.5, 12);
    expect(rmse(y, p)).toBeCloseTo(Math.sqrt(0.375), 12);
    expect(mape(y, p)).toBeCloseTo(0.32738095238095233, 12);
  });

  it('classificationMetrics uses argmax and binary AUC on class 1', () => {
    const r = classificationMetrics([0, 0, 1, 1], M([[0.9, 0.1], [0.6, 0.4], [0.65, 0.35], [0.2, 0.8]]));
    expect(Array.from(r.pred)).toEqual([0, 0, 0, 1]);
    expect(r.metrics.auc).toBeCloseTo(0.75);
    expect(r.metrics.accuracy).toBe(0.75);
  });
});

describe('splits', () => {
  it('hold-out is disjoint, complete and stratified', () => {
    const y = Array.from({ length: 1000 }, (_, i) => (i < 900 ? 0 : 1));
    const s = holdoutSplit(1000, new Rng(1), { validFraction: 0.2, testFraction: 0.1, stratify: y });
    const all = [...s.train, ...s.valid, ...s.test].sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: 1000 }, (_, i) => i));
    expect(s.valid.length).toBe(200);
    expect(s.test.length).toBe(100);
    expect(Array.from(s.valid).filter((i) => y[i] === 1).length).toBe(20);
    expect(Array.from(s.test).filter((i) => y[i] === 1).length).toBe(10);
  });

  it('hold-out is reproducible and keeps a training row for tiny strata', () => {
    const a = holdoutSplit(50, new Rng(3), { validFraction: 0.3 });
    const b = holdoutSplit(50, new Rng(3), { validFraction: 0.3 });
    expect(Array.from(a.valid)).toEqual(Array.from(b.valid));
    const tiny = holdoutSplit(3, new Rng(1), { validFraction: 0.5, stratify: [0, 1, 1] });
    expect(tiny.train.length).toBeGreaterThanOrEqual(2);
  });

  it('k-fold covers each row exactly once, stratified sizes balanced', () => {
    const y = Array.from({ length: 103 }, (_, i) => i % 3);
    const folds = kFold(103, 5, new Rng(2), y);
    const counts = new Array(103).fill(0);
    for (const f of folds) {
      for (const i of f.valid) counts[i]++;
      expect(f.train.length + f.valid.length).toBe(103);
    }
    expect(counts.every((c) => c === 1)).toBe(true);
    const sizes = folds.map((f) => f.valid.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });
});

describe('preprocessing fits on training rows only', () => {
  const table = inferTable(
    ['x', 'c', 'd', 'y'],
    [
      ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '1000', 'NA'],
      ['a', 'a', 'b', 'b', 'a', 'b', 'a', 'b', 'a', 'b', 'zzz', 'NA'],
      Array.from({ length: 12 }, (_, i) => `2024-0${(i % 9) + 1}-15`),
      ['0', '1', '0', '1', '0', '1', '0', '1', '0', '1', '1', '0'],
    ],
  );
  const train = Int32Array.from({ length: 10 }, (_, i) => i);

  it('uses train statistics and maps unseen/missing values safely', () => {
    const st = fitPreprocessor(table, ['x', 'c', 'd'], train);
    const xs = st.steps[0];
    expect(xs.type === 'numeric' && xs.center).toBe(4.5); // valid outlier 1000 not included
    expect(st.outputNames.slice(0, 5)).toEqual(['x', 'c=a', 'c=b', 'c=__other__', 'd.year']);
    const X = transform(st, table, [10, 11]);
    // row 10: c = 'zzz' unseen → other
    expect(X.data[1 * 0 + 3]).toBe(1);
    // row 11: x missing → median of train (4.5) → standardised 0
    expect(X.data[X.cols + 0]).toBeCloseTo(0);
    expect(X.data[X.cols + 3]).toBe(1); // missing category unseen in train → other
    expect(JSON.parse(JSON.stringify(st))).toEqual(st); // serialisable
  });

  it('infers tasks and encodes targets', () => {
    expect(inferTask(table.columns[3])).toBe('binary');
    expect(inferTask(table.columns[0])).toBe('regression');
    const ts = fitTarget(table, 'c', 'multiclass', train);
    expect(ts.task === 'binary' || ts.task === 'multiclass').toBe(true);
    const y = encodeTarget(ts, table);
    expect(y[11]).toBeNaN();
  });
});
