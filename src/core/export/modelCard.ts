import type { MetricName, MetricSet } from '../ml/metrics';
import type { DatasetRecord, ExperimentRecord } from '../project/types';

/** Generic model card for any experiment (Auto mode has a richer one in core/auto/modelCard). */
export function experimentModelCard(exp: ExperimentRecord, dataset: DatasetRecord | undefined, pluginLabel: string, projectName: string): string {
  if (exp.config.pluginId === 'auto' && exp.notes?.[0]?.startsWith('# Model card')) return exp.notes[0];
  const names: MetricName[] = exp.task === 'regression' ? ['rmse', 'mae', 'r2', 'mape'] : ['accuracy', 'auc', 'macroF1', 'logLoss'];
  const fmt = (m?: MetricSet) => names.map((k) => `${k}=${m?.[k] === undefined ? '—' : m[k]!.toFixed(4)}`).join(', ');
  const split = exp.config.split;
  return [
    `# Model card — ${exp.name}`,
    '',
    `- Project: ${projectName}`,
    `- Created: ${new Date(exp.createdAt).toISOString()}`,
    `- Model: ${pluginLabel} (${exp.config.pluginId}); parameters: ${JSON.stringify(exp.config.params)}`,
    `- Task: ${exp.task}${exp.classes ? ` (classes: ${exp.classes.join(', ')})` : ''}; target: ${exp.config.target}`,
    '',
    '## Data',
    `- Dataset "${dataset?.name ?? exp.config.datasetId}" (version ${exp.datasetHash.slice(0, 8)}), ${dataset?.rowCount ?? '?'} rows.`,
    `- Features (${exp.config.features.length}): ${exp.config.features.join(', ')}`,
    `- Split: ${split ? `${split.kind}${split.kind === 'kfold' ? ` (${split.folds ?? 5} folds)` : ` (valid ${split.validFraction})`}${split.testFraction ? `, test ${split.testFraction}` : ''}` : `hold-out ${exp.config.validFraction}`}; seed ${exp.config.seed}.`,
    `- Preprocessing (fitted on training rows only): ${exp.config.preprocess.numericImpute} imputation${exp.config.preprocess.missingIndicators ? ' + missing indicators' : ''}, ${exp.config.preprocess.numericScaling} scaling, ${exp.config.preprocess.categoricalEncoding ?? 'onehot'} encoding.`,
    ...(exp.skippedColumns?.length ? [`- Skipped columns: ${exp.skippedColumns.map((s) => `${s.column} (${s.reason})`).join(', ')}`] : []),
    '',
    '## Scores',
    `- Training: ${fmt(exp.metrics?.train)}`,
    `- ${exp.metrics?.cv ? 'Cross-validation mean' : 'Validation'}: ${fmt(exp.metrics?.valid)}`,
    ...(exp.metrics?.test ? [`- Held-out test (evaluated once): ${fmt(exp.metrics.test)}`] : []),
    ...(exp.permutation?.length ? ['', '## Most important features (permutation, validation)', ...exp.permutation.slice(0, 8).map((p) => `- ${p.feature}: ${p.mean.toFixed(4)} ± ${p.ci95.toFixed(4)}`)] : []),
    '',
    '## Limitations',
    '- Estimated on this dataset only; check for distribution shift before deployment.',
    '- Review the data-quality report (target leakage, imbalance) before trusting high scores.',
    '',
  ].join('\n');
}
