import type { MetricName, MetricSet } from '../ml/metrics';
import type { AutoOutput } from '../workers/types';

/** Markdown model card (data, method, scores, limitations) for an Auto-mode result. */
export function autoModelCard(o: AutoOutput, info: { project: string; dataset: string; datasetHash: string; target: string; features: string[]; preset: string; seed: number; rows: number }): string {
  const metrics: MetricName[] = o.task === 'regression' ? ['rmse', 'mae', 'r2', 'mape'] : ['accuracy', 'auc', 'macroF1', 'logLoss'];
  const fmt = (m?: MetricSet) => metrics.map((k) => `${k}=${m?.[k] === undefined ? '—' : m[k]!.toFixed(4)}`).join(', ');
  const members = o.ensemble.weights.filter((w) => w.weight > 0);
  const best = o.candidates.find((c) => c.foldsDone > 0 && !c.error);
  return [
    `# Model card — ${info.dataset} → ${info.target}`,
    '',
    `- Project: ${info.project}`,
    `- Generated: ${new Date().toISOString()}`,
    `- Task: ${o.task}${o.target.task !== 'regression' ? ` (classes: ${o.target.classes.join(', ')})` : ''}`,
    '',
    '## Data',
    `- Dataset "${info.dataset}" (version ${info.datasetHash.slice(0, 8)}), ${info.rows} rows; ${o.nDev} used for model selection, ${o.nTest} held out as test.`,
    `- Features (${info.features.length}): ${info.features.join(', ')}`,
    '- Preprocessing fitted on training folds only: median imputation + missing indicators, standardisation, one-hot encoding (top 30 categories + other).',
    '',
    '## Method',
    `- AutoML preset "${info.preset}", seed ${info.seed}; validation: ${o.validation.kind === 'kfold' ? `${o.validation.folds}-fold cross-validation (stratified for classification)` : 'hold-out 20%'}.`,
    `- ${o.candidates.length} candidate configurations (portfolio defaults + TPE search with successive halving).`,
    `- Final model: Caruana ensemble selection over out-of-fold predictions; each member is bagged over its fold models.`,
    `- Members: ${members.map((m) => `${m.label} (${(m.weight * 100).toFixed(0)}%)`).join(', ')}`,
    '',
    '## Scores',
    `- Ensemble, out-of-fold: ${fmt(o.ensemble.oof)}`,
    o.ensemble.test ? `- Ensemble, held-out test (evaluated once): ${fmt(o.ensemble.test)}` : '- No held-out test set was used.',
    best ? `- Best single model (${best.label}), CV mean: ${fmt(best.cv?.mean)}` : '',
    '',
    '## Limitations',
    '- Scores are estimates from this dataset only; performance can degrade under distribution shift.',
    '- Check the data-quality report for possible target leakage before trusting very high scores.',
    '- Classification probabilities are not calibrated beyond what each model provides.',
    '- Trained entirely in the browser (Pyodide / TF.js); pickled Python models require scikit-learn/XGBoost versions compatible with Pyodide ' + 'used here.',
    '',
  ].join('\n');
}
