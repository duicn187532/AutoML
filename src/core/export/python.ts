import { SKLEARN_DEFS } from '../models/builtin/sklearn';
import { num, str } from '../models/params';
import type { ParamValues } from '../models/types';
import type { ExperimentRecord } from '../project/types';

/**
 * Generate a Python (pandas + scikit-learn / XGBoost / LightGBM) script that reproduces an
 * experiment's preprocessing, split and model. `mode: 'workbench'` loads data with aml.load()
 * (Script mode); 'standalone' reads a CSV file.
 */
/** Gaussian-process kernels are passed from the model definitions as `{ $kernel: 'rbf_white' }`. */
export const GP_KERNELS: Record<string, { code: string; imports: string }> = {
  rbf_white: { code: 'ConstantKernel(1.0) * RBF(length_scale=1.0) + WhiteKernel(noise_level=0.1)', imports: 'from sklearn.gaussian_process.kernels import ConstantKernel, RBF, WhiteKernel' },
};
const py = (v: unknown): string => {
  if (v === null || v === undefined) return 'None';
  if (typeof v === 'object' && v && '$kernel' in v) return GP_KERNELS[String((v as { $kernel: string }).$kernel)].code;
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'None';
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(py).join(', ')}]`;
  return `{${Object.entries(v as Record<string, unknown>).map(([k, x]) => `${JSON.stringify(k)}: ${py(x)}`).join(', ')}}`;
};
const kwargs = (o: Record<string, unknown>) => Object.entries(o).map(([k, v]) => `${k}=${py(v)}`).join(', ');

export function estimatorCode(pluginId: string, p: ParamValues, task: string, seed: number): { imports: string[]; code: string; note?: string } {
  const cls = task !== 'regression';
  const def = SKLEARN_DEFS.find((d) => d.id === pluginId);
  if (def) {
    const path = cls ? def.estimator.cls! : def.estimator.reg!;
    const mod = path.slice(0, path.lastIndexOf('.')), name = path.slice(path.lastIndexOf('.') + 1);
    const kw = def.kwargs(p, { task: task as never, seed, nClasses: 0 });
    const kernel = Object.values(kw).find((v): v is { $kernel: string } => typeof v === 'object' && v !== null && '$kernel' in v);
    return { imports: [`from ${mod} import ${name}`, ...(kernel ? [GP_KERNELS[kernel.$kernel].imports] : [])], code: `${name}(${kwargs(kw)})` };
  }
  if (pluginId === 'logistic') return { imports: ['from sklearn.linear_model import LogisticRegression'], code: `LogisticRegression(C=${py(1 / Math.max(1e-12, num(p, 'l2')) / 1000)}, max_iter=2000)`, note: 'Workbench uses Adam + L2 with early stopping; sklearn uses L-BFGS — scores will be close, not identical.' };
  if (pluginId === 'ridge') return { imports: ['from sklearn.linear_model import Ridge'], code: `Ridge(alpha=${py(num(p, 'alpha'))})` };
  if (pluginId === 'mlp') {
    const units = Array.from({ length: num(p, 'hiddenLayers') }, (_, i) => Math.max(4, Math.round(num(p, 'units') / 2 ** i)));
    const C = cls ? 'MLPClassifier' : 'MLPRegressor';
    return { imports: [`from sklearn.neural_network import ${C}`], code: `${C}(hidden_layer_sizes=${py(units)}, activation=${py(str(p, 'activation') === 'elu' ? 'relu' : str(p, 'activation'))}, alpha=${py(num(p, 'l2'))}, learning_rate_init=${py(num(p, 'learningRate'))}, batch_size=${py(num(p, 'batchSize'))}, max_iter=${py(num(p, 'epochs'))}, early_stopping=True, n_iter_no_change=${py(Math.max(1, num(p, 'patience')))}, random_state=${seed})`, note: 'Workbench MLP runs on TF.js (dropout supported); this is the closest scikit-learn equivalent.' };
  }
  throw new Error(`No Python export for ${pluginId}`);
}

export function experimentToPython(exp: ExperimentRecord, dataset: { name: string; columns: { name: string; kind: string }[] }, mode: 'workbench' | 'standalone'): string {
  const c = exp.config;
  if (c.pluginId === 'auto') throw new Error('Python export of AutoML ensembles is not supported yet');
  const task = exp.task ?? c.task ?? 'binary';
  const cls = task !== 'regression';
  const kinds = new Map(dataset.columns.map((x) => [x.name, x.kind]));
  const features = c.features.filter((f) => f !== c.target);
  const numeric = features.filter((f) => kinds.get(f) === 'numeric');
  const categorical = features.filter((f) => kinds.get(f) === 'categorical');
  const dates = features.filter((f) => kinds.get(f) === 'datetime');
  const est = estimatorCode(c.pluginId, c.params, task, c.seed);
  const split = c.split ?? { kind: 'holdout', validFraction: c.validFraction, testFraction: 0 };
  const enc = c.preprocess.categoricalEncoding ?? 'onehot';
  const catEncoder = enc === 'ordinal' ? 'OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)'
    : enc === 'target' ? `TargetEncoder(random_state=${c.seed})`
    : `OneHotEncoder(handle_unknown="infrequent_if_exist", max_categories=${c.preprocess.maxCategories + 1})`;
  const scaler = c.preprocess.numericScaling === 'minmax' ? 'MinMaxScaler()' : c.preprocess.numericScaling === 'none' ? '"passthrough"' : 'StandardScaler()';
  const lines = [
    `# Generated by AutoML Workbench — experiment "${exp.name}" (seed ${c.seed})`,
    ...(est.note ? [`# Note: ${est.note}`] : []),
    'import numpy as np',
    'import pandas as pd',
    'from sklearn.compose import ColumnTransformer',
    'from sklearn.impute import SimpleImputer',
    'from sklearn.metrics import accuracy_score, roc_auc_score, mean_squared_error, r2_score',
    'from sklearn.model_selection import train_test_split' + (split.kind === 'kfold' ? ', cross_val_score, StratifiedKFold, KFold' : ''),
    'from sklearn.pipeline import Pipeline, make_pipeline',
    `from sklearn.preprocessing import ${['OneHotEncoder', 'OrdinalEncoder', 'TargetEncoder', 'StandardScaler', 'MinMaxScaler'].join(', ')}`,
    ...est.imports,
    '',
    mode === 'workbench' ? `df = aml.load(${py(dataset.name)})` : `df = pd.read_csv(${py(`${dataset.name}.csv`)})`,
    `target = ${py(c.target)}`,
    'df = df[df[target].notna()]',
    ...dates.map((d) => `df[${py(d)}] = pd.to_datetime(df[${py(d)}], errors="coerce")`),
    ...dates.flatMap((d) => ['year', 'month', 'day', 'dayofweek'].map((part) => `df[${py(`${d}.${part}`)}] = df[${py(d)}].dt.${part}`)),
    `numeric = ${py([...numeric, ...dates.flatMap((d) => ['year', 'month', 'day', 'dayofweek'].map((p) => `${d}.${p}`))])}`,
    `categorical = ${py(categorical)}`,
    `X = df[numeric + categorical]`,
    cls ? `y = df[target].astype(str)` : `y = df[target].astype(float)`,
    '',
    '# Preprocessing is fitted inside the pipeline → only on training rows (no leakage).',
    'pre = ColumnTransformer([',
    `    ("num", make_pipeline(SimpleImputer(strategy=${py(c.preprocess.numericImpute)}, add_indicator=${py(c.preprocess.missingIndicators)}), ${scaler}), numeric),`,
    `    ("cat", make_pipeline(SimpleImputer(strategy="constant", fill_value="__missing__"), ${catEncoder}), categorical),`,
    '])',
    `model = Pipeline([("pre", pre), ("model", ${est.code})])`,
    '',
  ];
  const evalLines = cls
    ? ['print("accuracy", accuracy_score(y_valid, model.predict(X_valid)))', 'proba = model.predict_proba(X_valid)', 'print("AUC", roc_auc_score(y_valid, proba[:, 1]) if proba.shape[1] == 2 else roc_auc_score(y_valid, proba, multi_class="ovr"))']
    : ['pred = model.predict(X_valid)', 'print("RMSE", mean_squared_error(y_valid, pred) ** 0.5, "R2", r2_score(y_valid, pred))'];
  if (split.kind === 'kfold') {
    lines.push(
      `cv = ${cls ? 'StratifiedKFold' : 'KFold'}(n_splits=${split.folds ?? 5}, shuffle=True, random_state=${c.seed})`,
      `scores = cross_val_score(model, X, y, cv=cv, scoring=${py(cls ? 'accuracy' : 'neg_root_mean_squared_error')})`,
      'print("CV", scores.mean(), "+/-", scores.std())',
      'model.fit(X, y)',
    );
  } else if (split.kind === 'time') {
    lines.push(`order = df[${py(split.column)}].argsort(kind="stable").to_numpy()`, `n_valid = int(round(len(df) * ${split.validFraction}))`,
      'train_idx, valid_idx = order[:-n_valid], order[-n_valid:]', 'X_train, X_valid, y_train, y_valid = X.iloc[train_idx], X.iloc[valid_idx], y.iloc[train_idx], y.iloc[valid_idx]',
      `model.fit(X_train, y_train)`, ...evalLines);
  } else {
    lines.push(`X_train, X_valid, y_train, y_valid = train_test_split(X, y, test_size=${split.validFraction}, random_state=${c.seed}${cls ? ', stratify=y' : ''})`,
      'model.fit(X_train, y_train)', ...evalLines);
  }
  return lines.join('\n') + '\n';
}
