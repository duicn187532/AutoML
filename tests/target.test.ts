import { describe, expect, it } from 'vitest';
import type { ColumnProfile } from '@/core/data/table';
import { datasetTarget } from '@/core/project/target';

const col = (name: string, kind: ColumnProfile['kind'] = 'numeric') => ({ name, kind }) as ColumnProfile;

describe('datasetTarget', () => {
  it('prefers the remembered target', () => {
    expect(datasetTarget({ target: 'survived', columns: [col('survived'), col('alone')] })).toBe('survived');
  });
  it('ignores a remembered target that no longer exists', () => {
    expect(datasetTarget({ target: 'gone', columns: [col('a'), col('b')] })).toBe('b');
  });
  it('recognises conventional target names before falling back to the last column', () => {
    expect(datasetTarget({ columns: [col('survived'), col('pclass'), col('alone')] })).toBe('survived');
    expect(datasetTarget({ columns: [col('Label', 'categorical'), col('text', 'text')] })).toBe('Label');
    expect(datasetTarget({ columns: [col('x1'), col('price_m2')] })).toBe('price_m2');
  });
  it('handles an empty dataset', () => {
    expect(datasetTarget({ columns: [] })).toBe('');
  });
});
