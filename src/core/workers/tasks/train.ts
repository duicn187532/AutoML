import { cellString, getColumn, type ColumnarTable } from '../../data/table';
import { takeVector, type Matrix } from '../../ml/matrix';
import { classificationMetrics, regressionMetrics, rocCurve, type MetricSet } from '../../ml/metrics';
import { encodeTarget, fitPreprocessor, fitTarget, inferTask, labelledRows, transform, type PreprocessorState, type TargetState, type TaskKind } from '../../ml/preprocess';
import { groupKFold, groupSplit, holdoutSplit, kFold, timeSplit, type Fold, type SplitConfig, type SplitIndices } from '../../ml/split';
import { validateParams } from '../../models/params';
import { getPlugin } from '../../models/registry';
import type { ModelArtifact, ModelPlugin, ParamValues, TrainedModel } from '../../models/types';
import { Rng } from '../../rng';
import { permutationImportance } from '../../ml/permutation';
import type { TaskContext, TrainInput, TrainOutput } from '../types';

/**
 * Supervised training. Order matters for leakage:
 * split first → fit preprocessing + target scaling on TRAIN rows only → transform → fit → evaluate.
 * The test part (if any) is evaluated exactly once, at the very end. k-fold refits the
 * preprocessing inside every fold. Every random step draws from a labelled fork of the seed.
 */
export interface FitResult {
  model: TrainedModel;
  prep: PreprocessorState;
  target: TargetState;
  history: Record<string, number[]>;
  bestEpoch?: number;
  notes: string[];
  train: MetricSet;
  valid: MetricSet;
  validEval?: Evaluation;
}

export interface Evaluation {
  metrics: MetricSet;
  confusion?: number[][];
  roc?: { fpr: number[]; tpr: number[] };
  y: Float64Array;
  pred: Float64Array;
  proba?: Matrix;
}

function evaluate(model: TrainedModel, X: Matrix, yEnc: Float64Array, yRaw: Float64Array, target: TargetState): Evaluation {
  if (target.task === 'regression') {
    const pred = model.predict(X).map((v) => v * target.std + target.mean);
    return { metrics: regressionMetrics(yRaw, pred), y: yRaw, pred };
  }
  if (!model.predictProba) throw new Error('Classifier must implement predictProba');
  const P = model.predictProba(X);
  const r = classificationMetrics(yEnc, P);
  const roc = P.cols === 2 ? rocCurve(yEnc, P.data.filter((_, i) => i % 2 === 1)) : undefined;
  return { metrics: r.metrics, confusion: r.confusion, roc: roc && { fpr: roc.fpr, tpr: roc.tpr }, y: yEnc, pred: Float64Array.from(r.pred), proba: P };
}

export async function fitOnce(
  table: ColumnarTable, input: TrainInput, plugin: ModelPlugin, params: ParamValues, task: TaskKind,
  classState: TargetState | null, yRaw: Float64Array, trainRows: Int32Array, validRows: Int32Array,
  rng: Rng, ctx: TaskContext, progress: (f: number, point?: Record<string, number>) => void,
): Promise<FitResult> {
  const { config } = input;
  const features = config.features.filter((f) => f !== config.target);
  const target = classState ?? fitTarget(table, config.target, 'regression', trainRows);
  const nClasses = target.task === 'regression' ? 0 : target.classes.length;
  const prep = fitPreprocessor(table, features, trainRows, config.preprocess, { y: yRaw, nClasses });
  if (!prep.outputNames.length) throw new Error('No usable features after preprocessing');
  const Xtr = transform(prep, table, trainRows), Xva = transform(prep, table, validRows);
  const enc = (rows: Int32Array) => {
    const y = takeVector(yRaw, rows);
    if (target.task === 'regression') for (let i = 0; i < y.length; i++) y[i] = (y[i] - target.mean) / target.std;
    return y;
  };
  const ytr = enc(trainRows), yva = enc(validRows);
  await ctx.checkpoint();
  const model = plugin.create({ task, nFeatures: Xtr.cols, nClasses, params, rng: rng.fork('model-init'), engine: ctx.engine });
  const report = await model.fit(
    { X: Xtr, y: ytr, valid: validRows.length ? { X: Xva, y: yva } : undefined },
    { rng: rng.fork('model-fit'), engine: ctx.engine, checkpoint: ctx.checkpoint, progress: (p) => progress(p.fraction, p.point) },
  );
  const trainEval = evaluate(model, Xtr, ytr, takeVector(yRaw, trainRows), target);
  const validEval = validRows.length ? evaluate(model, Xva, yva, takeVector(yRaw, validRows), target) : undefined;
  return { model, prep, target, history: report.history, bestEpoch: report.bestEpoch, notes: report.notes ?? [], train: trainEval.metrics, valid: validEval?.metrics ?? {}, validEval };
}

export function meanStd(folds: MetricSet[]): { mean: MetricSet; std: MetricSet } {
  const mean: MetricSet = {}, std: MetricSet = {};
  for (const k of Object.keys(folds[0] ?? {}) as (keyof MetricSet)[]) {
    const v = folds.map((f) => f[k]!).filter((x) => !Number.isNaN(x));
    const m = v.reduce((a, b) => a + b, 0) / (v.length || 1);
    mean[k] = m;
    std[k] = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)) : 0;
  }
  return { mean, std };
}

export async function trainTask(input: TrainInput, ctx: TaskContext): Promise<TrainOutput> {
  const t0 = performance.now();
  const { table, config } = input;
  const plugin = getPlugin(config.pluginId);
  const rng = new Rng(config.seed);
  const task = config.task ?? inferTask(getColumn(table, config.target));
  if (!plugin.tasks.includes(task)) throw new Error(`${plugin.id} does not support ${task}`);
  if (!config.features.some((f) => f !== config.target)) throw new Error('No feature columns selected');
  const split: SplitConfig = config.split ?? { kind: 'holdout', validFraction: config.validFraction, testFraction: 0 };
  const { params } = validateParams(plugin.params, config.params);

  ctx.progress({ fraction: 0.02, message: 'split' });
  // rows with a label; class list from all rows (no statistics involved)
  const allIdx = Int32Array.from({ length: table.rowCount }, (_, i) => i);
  const classState = task === 'regression' ? null : fitTarget(table, config.target, task, allIdx);
  const yRaw = encodeTarget(classState ?? { task: 'regression', column: config.target, mean: 0, std: 1 }, table);
  const labelled = labelledRows(yRaw);
  if (labelled.length < 10) throw new Error('Too few labelled rows');
  const strat = classState ? takeVector(yRaw, labelled) : undefined;
  const colValues = (name: string) => {
    const c = getColumn(table, name);
    return Array.from(labelled, (r) => (c.kind === 'numeric' ? c.values[r] : (cellString(c, r) ?? '')));
  };
  const splitRng = rng.fork('split');

  // 1. carve out the test part (never touched until the end)
  let outer: SplitIndices;
  const vf = split.kind === 'kfold' ? 0 : split.validFraction;
  if (split.kind === 'time') outer = timeSplit(colValues(split.column!) as number[], { validFraction: vf, testFraction: split.testFraction });
  else if (split.kind === 'group') outer = groupSplit(colValues(split.column!), splitRng, { validFraction: vf, testFraction: split.testFraction });
  else outer = holdoutSplit(labelled.length, splitRng, { validFraction: vf, testFraction: split.testFraction, stratify: strat });
  const rows = (ix: Int32Array) => takeVector(labelled, ix);
  const testRows = rows(outer.test);

  let final: FitResult;
  let cv: TrainOutput['metrics']['cv'];
  let nValid: number;
  if (split.kind === 'kfold') {
    const k = split.folds ?? 5;
    const devRows = rows(outer.train);
    const devStrat = strat ? takeVector(yRaw, devRows) : undefined;
    const folds: Fold[] = split.column
      ? groupKFold(Array.from(devRows, (r) => cellString(getColumn(table, split.column!), r) ?? ''), k, rng.fork('folds'))
      : kFold(devRows.length, k, rng.fork('folds'), devStrat);
    const foldMetrics: MetricSet[] = [];
    for (let f = 0; f < k; f++) {
      const r = await fitOnce(table, input, plugin, params, task, classState, yRaw, takeVector(devRows, folds[f].train), takeVector(devRows, folds[f].valid), rng.fork(`fold${f}`), ctx,
        (fr, point) => ctx.progress({ fraction: 0.05 + (0.8 * (f + fr)) / (k + 1), message: `fold ${f + 1}/${k}`, point: point && f === 0 ? point : undefined }));
      foldMetrics.push(r.valid);
      r.model.dispose?.();
    }
    cv = { folds: foldMetrics, ...meanStd(foldMetrics) };
    ctx.progress({ fraction: 0.85, message: 'refit' });
    final = await fitOnce(table, input, plugin, params, task, classState, yRaw, devRows, new Int32Array(0), rng.fork('final'), ctx, () => {});
    final.valid = cv.mean;
    nValid = devRows.length;
  } else {
    const trainRows = rows(outer.train), validRows = rows(outer.valid);
    final = await fitOnce(table, input, plugin, params, task, classState, yRaw, trainRows, validRows, rng.fork('holdout'), ctx,
      (fr, point) => ctx.progress({ fraction: 0.05 + 0.9 * fr, point }));
    nValid = validRows.length;
  }

  // 2. the single, final test evaluation
  ctx.progress({ fraction: 0.97, message: 'evaluate' });
  let test: MetricSet | undefined;
  if (testRows.length) {
    const Xte = transform(final.prep, table, testRows);
    const yte = takeVector(yRaw, testRows);
    const tg = final.target;
    const yEnc = tg.task === 'regression' ? yte.map((v) => (v - tg.mean) / tg.std) : yte;
    test = evaluate(final.model, Xte, yEnc, yte, tg).metrics;
  }
  const ve = final.validEval;
  const importance = (final.model as { featureImportances?: () => Float64Array | null }).featureImportances?.();
  // permutation importance on the validation rows (hold-out only; capped at ~10 s)
  let permutation: TrainOutput['permutation'];
  if (split.kind !== 'kfold' && final.validEval && outer.valid.length >= 20) {
    ctx.progress({ fraction: 0.98, message: 'permutation importance' });
    const vrows = rows(outer.valid);
    permutation = await permutationImportance(final.model, final.prep, final.target, table, vrows, takeVector(yRaw, vrows), rng.fork('perm'),
      { repeats: 5, deadline: performance.now() + 10_000, checkpoint: ctx.checkpoint });
  }
  const artifact: ModelArtifact = await final.model.export();
  final.model.dispose?.();
  ctx.progress({ fraction: 1 });
  const cap = 5000; // keep project files small
  return {
    task,
    target: final.target,
    preprocessor: final.prep,
    metrics: { train: final.train, valid: final.valid, test, cv },
    confusion: ve?.confusion,
    roc: ve?.roc,
    validPredictions: ve ? {
      y: Array.from(ve.y.subarray(0, cap)),
      pred: Array.from(ve.pred.subarray(0, cap)),
      proba: ve.proba ? Array.from({ length: Math.min(cap, ve.proba.rows) }, (_, i) => Array.from(ve.proba!.data.subarray(i * ve.proba!.cols, (i + 1) * ve.proba!.cols))) : undefined,
    } : undefined,
    featureNames: final.prep.outputNames,
    featureImportance: importance ? Array.from(importance) : undefined,
    permutation,
    history: final.history,
    bestEpoch: final.bestEpoch,
    notes: final.notes,
    artifact,
    nTrain: outer.train.length,
    nValid,
    nTest: testRows.length,
    durationMs: performance.now() - t0,
  };
}
