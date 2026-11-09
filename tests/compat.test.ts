import { describe, expect, it } from 'vitest';
import { applyStep } from '@/core/data/ops';
import { cellString, getColumn } from '@/core/data/table';
import { modelAdvice } from '@/core/models/advice';
import { SKLEARN_DEFS } from '@/core/models/builtin/sklearn';
import { estimatorCode } from '@/core/export/python';
import { loadSample } from './helpers';

describe('model / data compatibility advice', () => {
  const prof = (kinds: string[]) => kinds.map((k, i) => ({ name: `c${i}`, kind: k as never, missing: 0, unique: 2 }));
  it('warns about Gaussian processes and SVMs on large data only', () => {
    expect(modelAdvice('gaussian_process', 'binary', 2000, prof(['numeric']))).toHaveLength(0);
    expect(modelAdvice('gaussian_process', 'binary', 5000, prof(['numeric']))[0].level).toBe('warn');
    expect(modelAdvice('svm', 'binary', 9000, prof(['numeric']))).toHaveLength(0);
    expect(modelAdvice('svm', 'binary', 30000, prof(['numeric']))).toHaveLength(1);
  });
  it('flags Gaussian naive Bayes / QDA on text or mostly categorical features', () => {
    expect(modelAdvice('naive_bayes', 'binary', 500, prof(['text']))).toHaveLength(1);
    expect(modelAdvice('qda', 'binary', 500, prof(['categorical', 'categorical', 'numeric']))).toHaveLength(1);
    expect(modelAdvice('naive_bayes', 'binary', 500, prof(['numeric', 'numeric']))).toHaveLength(0);
  });
  it('notes that tree models cannot extrapolate date trends in regression', () => {
    expect(modelAdvice('random_forest', 'regression', 500, prof(['datetime', 'numeric']))).toHaveLength(1);
    expect(modelAdvice('ridge', 'regression', 500, prof(['datetime', 'numeric']))).toHaveLength(0);
  });
});

describe('sampleRows step', () => {
  it('draws a reproducible, stratified sample and keeps row order', () => {
    const t = loadSample('credit-default-taiwan.csv');
    const s = { op: 'sampleRows' as const, n: 3000, seed: 7, stratify: 'default_next_month' };
    const a = applyStep(t, s), b = applyStep(t, s);
    expect(Math.abs(a.rowCount - 3000)).toBeLessThanOrEqual(2);
    const ids = (x: typeof a) => Array.from({ length: x.rowCount }, (_, i) => Number(cellString(getColumn(x, 'ID'), i)));
    expect(ids(a)).toEqual(ids(b));
    expect([...ids(a)].sort((x, y) => x - y)).toEqual(ids(a));
    const rate = (x: typeof a) => { const c = getColumn(x, 'default_next_month'); let p = 0; for (let i = 0; i < x.rowCount; i++) p += Number(cellString(c, i)); return p / x.rowCount; };
    expect(Math.abs(rate(a) - rate(t))).toBeLessThan(0.002);
    expect(applyStep(t, { ...s, n: 1e9 }).rowCount).toBe(t.rowCount);
  });
});

describe('Gaussian process regression', () => {
  it('learns a noise term instead of interpolating the training rows', () => {
    const def = SKLEARN_DEFS.find((d) => d.id === 'gaussian_process')!;
    expect(def.kwargs({ restarts: 0 }, { task: 'regression', seed: 1, nClasses: 0 }).kernel).toEqual({ $kernel: 'rbf_white' });
    const code = estimatorCode('gaussian_process', { restarts: 0 }, 'regression', 1);
    expect(code.code).toContain('WhiteKernel(noise_level=0.1)');
    expect(code.imports.join('\n')).toContain('from sklearn.gaussian_process.kernels import');
  });
});

describe('Python fit errors', () => {
  it('reduce tracebacks to one line and explain out-of-memory', async () => {
    const { pythonFitError } = await import('@/core/models/builtin/sklearn');
    const tb = 'Traceback (most recent call last):\n  File "x.py", line 1, in fit\nnumpy._core._exceptions._ArrayMemoryError: Unable to allocate 1.9 GiB for an array with shape (16512, 16512)';
    const m = pythonFitError(new Error(tb), 'Gaussian process', 16512, 13);
    expect(m).toContain('not enough browser memory');
    expect(m).toContain('16,512 rows');
    expect(m).not.toContain('Traceback');
    expect(pythonFitError(new Error('Traceback\nValueError: bad input'), 'SVM', 1, 1)).toBe('SVM: ValueError: bad input');
  });
});

describe('forecast input with several rows per timestamp', () => {
  it('collapses duplicates by sum or mean instead of treating them as time steps', async () => {
    const { collapseTimestamps } = await import('@/core/workers/tasks/analysis');
    const mk = () => [{ t: 1, y: 2 }, { t: 1, y: 4 }, { t: 2, y: 5 }, { t: 3, y: 1 }, { t: 3, y: 2 }, { t: 3, y: 3 }];
    const a = mk(); expect(collapseTimestamps(a, 'sum')).toBe(3); expect(a.map((r) => r.y)).toEqual([6, 5, 6]);
    const b = mk(); collapseTimestamps(b, 'mean'); expect(b.map((r) => r.y)).toEqual([3, 5, 2]);
    const c = [{ t: 1, y: 1 }, { t: 2, y: 2 }]; expect(collapseTimestamps(c, 'sum')).toBe(0); expect(c).toHaveLength(2);
  });
});
