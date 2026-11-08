import { getColumn } from '../../data/table';
import { takeVector } from '../../ml/matrix';
import { classificationMetrics, regressionMetrics, rocCurve } from '../../ml/metrics';
import { encodeTarget, fitPreprocessor, fitTarget, inferTask, labelledRows, transform } from '../../ml/preprocess';
import { holdoutSplit } from '../../ml/split';
import { validateParams } from '../../models/params';
import { getPlugin } from '../../models/registry';
import type { TrainedModel } from '../../models/types';
import { Rng } from '../../rng';
import type { TaskContext, TrainInput, TrainOutput } from '../types';

/**
 * Supervised training on a hold-out split. Order matters for leakage:
 * split first → fit preprocessing + target scaling on TRAIN rows only → transform both → fit → evaluate.
 * Every random step draws from a labelled fork of the experiment seed (reproducible re-runs).
 */
export async function trainTask(input: TrainInput, ctx: TaskContext): Promise<TrainOutput> {
  const t0 = performance.now();
  const { table, config } = input;
  const plugin = getPlugin(config.pluginId);
  const rng = new Rng(config.seed);
  const task = config.task ?? inferTask(getColumn(table, config.target));
  if (!plugin.tasks.includes(task)) throw new Error(`${plugin.id} does not support ${task}`);
  const features = config.features.filter((f) => f !== config.target);
  if (!features.length) throw new Error('No feature columns selected');

  ctx.progress({ fraction: 0.02, message: 'split' });
  // 1. rows with a label, encoded with the full class list (no statistics involved)
  const allIdx = Int32Array.from({ length: table.rowCount }, (_, i) => i);
  const classState = task === 'regression' ? null : fitTarget(table, config.target, task, allIdx);
  const yRaw = encodeTarget(classState ?? { task: 'regression', column: config.target, mean: 0, std: 1 }, table);
  const labelled = labelledRows(yRaw);
  if (labelled.length < 4) throw new Error('Too few labelled rows');

  // 2. split
  const strat = classState ? takeVector(yRaw, labelled) : undefined;
  const split = holdoutSplit(labelled.length, rng.fork('split'), { validFraction: config.validFraction, stratify: strat });
  const trainRows = takeVector(labelled, split.train);
  const validRows = takeVector(labelled, split.valid);

  // 3. fit preprocessing on train only
  const targetState = classState ?? fitTarget(table, config.target, 'regression', trainRows);
  const prep = fitPreprocessor(table, features, trainRows, config.preprocess);
  if (!prep.outputNames.length) throw new Error('No usable features after preprocessing');
  const Xtr = transform(prep, table, trainRows);
  const Xva = transform(prep, table, validRows);
  const scaleY = (rows: Int32Array) => {
    const y = takeVector(yRaw, rows);
    if (targetState.task === 'regression') for (let i = 0; i < y.length; i++) y[i] = (y[i] - targetState.mean) / targetState.std;
    return y;
  };
  const ytr = scaleY(trainRows), yva = scaleY(validRows);
  await ctx.checkpoint();

  // 4. fit
  const nClasses = targetState.task === 'regression' ? 0 : targetState.classes.length;
  const { params } = validateParams(plugin.params, config.params);
  const model: TrainedModel = plugin.create({ task, nFeatures: Xtr.cols, nClasses, params, rng: rng.fork('model-init'), engine: ctx.engine });
  const report = await model.fit(
    { X: Xtr, y: ytr, valid: validRows.length ? { X: Xva, y: yva } : undefined },
    {
      rng: rng.fork('model-fit'),
      engine: ctx.engine,
      checkpoint: ctx.checkpoint,
      progress: (p) => ctx.progress({ fraction: 0.05 + 0.9 * p.fraction, point: p.point, message: p.message }),
    },
  );

  // 5. evaluate (regression metrics in ORIGINAL units)
  ctx.progress({ fraction: 0.97, message: 'evaluate' });
  const out: Pick<TrainOutput, 'metrics' | 'confusion' | 'roc'> = { metrics: { train: {}, valid: {} } };
  if (targetState.task === 'regression') {
    const unscale = (p: Float64Array) => p.map((v) => v * targetState.std + targetState.mean);
    out.metrics.train = regressionMetrics(takeVector(yRaw, trainRows), unscale(model.predict(Xtr)));
    if (validRows.length) out.metrics.valid = regressionMetrics(takeVector(yRaw, validRows), unscale(model.predict(Xva)));
  } else {
    if (!model.predictProba) throw new Error(`${plugin.id} must implement predictProba for classification`);
    out.metrics.train = classificationMetrics(ytr, model.predictProba(Xtr)).metrics;
    if (validRows.length) {
      const P = model.predictProba(Xva);
      const r = classificationMetrics(yva, P);
      out.metrics.valid = r.metrics;
      out.confusion = r.confusion;
      if (P.cols === 2) {
        const roc = rocCurve(yva, P.data.filter((_, i) => i % 2 === 1));
        out.roc = { fpr: roc.fpr, tpr: roc.tpr };
      }
    }
  }
  const artifact = await model.export();
  model.dispose?.();
  ctx.progress({ fraction: 1 });
  return {
    task,
    target: targetState,
    preprocessor: prep,
    ...out,
    history: report.history,
    bestEpoch: report.bestEpoch,
    notes: report.notes ?? [],
    artifact,
    nTrain: trainRows.length,
    nValid: validRows.length,
    durationMs: performance.now() - t0,
  };
}
