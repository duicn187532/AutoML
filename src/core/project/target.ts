import type { DatasetRecord } from './types';

/** Column names that almost always mean "the thing to predict". */
const TARGET_NAMES = /^(target|label|labels|class|y|outcome|survived|churn|default|response)$/i;

/**
 * Default prediction target of a dataset: the remembered choice, else a column with a
 * conventional target name, else the last column (the usual CSV convention).
 */
export function datasetTarget(d: Pick<DatasetRecord, 'target' | 'columns'>): string {
  if (d.target && d.columns.some((c) => c.name === d.target)) return d.target;
  const named = d.columns.find((c) => TARGET_NAMES.test(c.name) && c.kind !== 'id' && c.kind !== 'text');
  return (named ?? d.columns.at(-1))?.name ?? '';
}
