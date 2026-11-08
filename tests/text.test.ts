import { describe, expect, it } from 'vitest';
import { inferTable } from '@/core/data/infer';
import { fitPreprocessor, tokenize, transform } from '@/core/ml/preprocess';
import { amlTransform } from '@/core/export/runtime.js';

describe('TF-IDF text features', () => {
  it('tokenizes Latin words and CJK bigrams', () => {
    expect(tokenize('Great product, 非常好用!')).toEqual(['great', 'product', '非常', '常好', '好用']);
  });
  it('fits on train rows and matches the portable runtime', () => {
    const docs = ['good movie great acting', 'bad movie boring', 'great great fun', 'boring bad plot', 'good fun', 'bad acting'];
    const t = inferTable(['review'], [docs], { overrides: { review: 'text' } });
    const st = fitPreprocessor(t, ['review'], [0, 1, 2, 3]);
    const step = st.steps[0];
    expect(step.type).toBe('tfidf');
    const X = transform(st, t);
    const row = amlTransform(st, { review: docs[4] });
    expect(row.map((v) => +v.toFixed(9))).toEqual(Array.from(X.data.subarray(4 * X.cols, 5 * X.cols), (v) => +v.toFixed(9)));
  });
});
