/** Leakage-safe fold-local preprocessing for two-stage heterogeneous experts. */
import type { ColumnarTable } from '../data/table';
import { takeVector, type Matrix } from './matrix';
import { DEFAULT_PREPROCESS, fitPreprocessor, fitTarget, transform, type PreprocessorState, type TargetState } from './preprocess';
import type { Fold } from './split';

export interface ExpertFoldData {
  Xtrain: Matrix;
  Xvalid: Matrix;
  ytrain: Float64Array;
  target: TargetState;
  preprocessor: PreprocessorState;
  trainRows: Int32Array;
  validRows: Int32Array;
}

/** Inner held-out rows never participate in fitting the preprocessing or target scaler. */
export function prepareExpertFold(
  table: ColumnarTable, features: string[], devRows: Int32Array, fold: Fold,
  targetColumn: string, yRaw: Float64Array, outerTarget: TargetState,
): ExpertFoldData {
  const trainRows = takeVector(devRows, fold.train), validRows = takeVector(devRows, fold.valid);
  const preprocessor = fitPreprocessor(table, features, trainRows, DEFAULT_PREPROCESS);
  const Xtrain = transform(preprocessor, table, trainRows);
  const Xvalid = transform(preprocessor, table, validRows);
  const target = outerTarget.task === 'regression' ? fitTarget(table, targetColumn, 'regression', trainRows) : outerTarget;
  const values = takeVector(yRaw, trainRows);
  const ytrain = target.task === 'regression' ? Float64Array.from(values, (v) => (v - target.mean) / target.std) : values;
  return { Xtrain, Xvalid, ytrain, target, preprocessor, trainRows, validRows };
}

/** Convert inner-fold regression prediction to the outer target space for gate training. */
export function toOuterTargetScale(value: number, inner: TargetState, outer: TargetState): number {
  if (inner.task !== 'regression' || outer.task !== 'regression') throw new Error('Expected regression targets');
  return (value * inner.std + inner.mean - outer.mean) / outer.std;
}
