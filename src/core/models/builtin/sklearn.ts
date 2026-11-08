import type { PyBytes, PyHandle } from '../../engines/adapters';
import type { Matrix } from '../../ml/matrix';
import type { TaskKind } from '../../ml/preprocess';
import { num, str } from '../params';
import type { EngineName, FitContext, FitData, ModelArtifact, ModelFamily, ModelInit, ModelPlugin, ParamSpec, ParamValues, TrainedModel } from '../types';
import type { I18nText } from '@/i18n/types';

/**
 * Pyodide-backed estimators (scikit-learn API: sklearn, XGBoost, LightGBM) declared as data.
 * Python runs synchronously inside the worker, so cancellation of a running fit is a hard cancel
 * (worker terminate) — progress callbacks (GBDT iterations) still stream to the UI.
 */
export interface SkDef {
  id: string;
  name: I18nText;
  description: I18nText;
  family: ModelFamily;
  tasks: TaskKind[];
  engines: EngineName[];
  estimator: { cls?: string; reg?: string };
  fitKind?: 'plain' | 'xgboost' | 'lightgbm';
  params: ParamSpec[];
  /** Constructor kwargs for the Python estimator. */
  kwargs(p: ParamValues, c: { task: TaskKind; seed: number; nClasses: number }): Record<string, unknown>;
  fitKwargs?(p: ParamValues): Record<string, unknown>;
  /** Param key giving the max number of iterations (for progress fraction). */
  iterParam?: string;
  taskDefaults?: ModelPlugin['taskDefaults'];
}

const bytesToF64 = (b: PyBytes): Float64Array => {
  const u8 = b.toJs();
  b.destroy();
  return new Float64Array(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
};

class SkModel implements TrainedModel {
  private h: PyHandle;
  constructor(
    private def: SkDef,
    private init: Omit<ModelInit, 'rng'>,
    private seed: number,
    private id: number | null = null,
  ) {
    this.h = init.engine<PyHandle>('pyodide');
    if (!this.h.bridge) throw new Error('Python bridge not loaded (py-sklearn engine missing)');
  }

  private get path() {
    const p = this.init.task === 'regression' ? this.def.estimator.reg : this.def.estimator.cls;
    if (!p) throw new Error(`${this.def.id} does not support ${this.init.task}`);
    return p;
  }

  async fit(data: FitData, ctx: FitContext) {
    const { bridge } = this.h;
    const p = this.init.params;
    const kw = this.def.kwargs(p, { task: this.init.task, seed: this.seed, nClasses: this.init.nClasses });
    if (this.id !== null) bridge.free(this.id);
    this.id = bridge.make(this.path, JSON.stringify(kw));
    ctx.progress({ fraction: 0.02, message: 'fit' });
    const total = this.def.iterParam ? num(p, this.def.iterParam) : 0;
    const history: Record<string, number[]> = { epoch: [], loss: [], val_loss: [] };
    const onPoint = (json: string) => {
      const pt = JSON.parse(json) as Record<string, number>;
      for (const k of ['epoch', 'loss', 'val_loss']) if (pt[k] !== undefined) history[k].push(pt[k]);
      ctx.progress({ fraction: total ? Math.min(0.99, pt.epoch / total) : 0.5, point: pt });
    };
    const v = data.valid;
    const empty = new Float64Array(0);
    const out = JSON.parse(
      bridge.fit(this.id, this.def.fitKind ?? 'plain', data.X.data, data.X.rows, data.X.cols, data.y, v?.X.data ?? empty, v?.X.rows ?? 0, v?.y ?? empty, onPoint, JSON.stringify(this.def.fitKwargs?.(p) ?? {})),
    ) as { bestEpoch?: number; notes: string[] };
    await ctx.checkpoint();
    ctx.progress({ fraction: 1 });
    return { history: history.epoch.length ? history : {}, bestEpoch: out.bestEpoch, epochs: history.epoch.length || undefined, notes: out.notes };
  }

  predict(X: Matrix) {
    return bytesToF64(this.h.bridge.predict(this.id!, X.data, X.rows, X.cols));
  }

  predictProba(X: Matrix): Matrix {
    const k = this.init.nClasses;
    return { rows: X.rows, cols: k, data: bytesToF64(this.h.bridge.predict_proba(this.id!, X.data, X.rows, X.cols, k)) };
  }

  featureImportances(): Float64Array | null {
    const b = this.h.bridge.feature_importances(this.id!);
    return b ? bytesToF64(b) : null;
  }

  async export(): Promise<ModelArtifact> {
    const b = this.h.bridge.dump(this.id!);
    const pickle = b.toJs();
    b.destroy();
    return {
      pluginId: this.def.id, pluginVersion: 1, task: this.init.task, nFeatures: this.init.nFeatures, nClasses: this.init.nClasses,
      params: this.init.params, payload: { format: 'python-pickle', estimator: this.path, runtime: 'pyodide' }, binary: { pickle },
    };
  }

  dispose() {
    if (this.id !== null) this.h.bridge.free(this.id);
    this.id = null;
  }
}

export function sklearnPlugin(def: SkDef): ModelPlugin {
  return {
    id: def.id, version: 1, name: def.name, description: def.description, family: def.family,
    tasks: def.tasks, engines: def.engines, params: def.params, taskDefaults: def.taskDefaults,
    create: (init) => new SkModel(def, init, init.rng.nextU32() % 2 ** 31),
    async load(a, init) {
      const h = init.engine<PyHandle>('pyodide');
      const id = h.bridge.load(a.binary!.pickle);
      return new SkModel(def, { ...init, params: a.params }, 0, id);
    },
  };
}

/* ---------------- definitions ---------------- */

const L = (zh: string, en: string): I18nText => ({ 'zh-TW': zh, en });
const int = (key: string, label: I18nText, d: number, min: number, max: number, rec?: [number, number], help?: I18nText, log = false): ParamSpec =>
  ({ key, type: 'int', label, default: d, min, max, recommended: rec, help, log });
const flt = (key: string, label: I18nText, d: number, min: number, max: number, rec?: [number, number], help?: I18nText, log = false): ParamSpec =>
  ({ key, type: 'float', label, default: d, min, max, recommended: rec, help, log });
const enm = (key: string, label: I18nText, d: string, opts: [string, I18nText][]): ParamSpec =>
  ({ key, type: 'enum', label, default: d, options: opts.map(([value, l]) => ({ value, label: l })) });

const SK: EngineName[] = ['pyodide', 'py-sklearn'];
const GB: EngineName[] = ['pyodide', 'py-sklearn', 'py-gbdt'];
const CLS: TaskKind[] = ['binary', 'multiclass'];
const ALL: TaskKind[] = ['binary', 'multiclass', 'regression'];
const depthNone = (p: ParamValues, k = 'maxDepth') => (num(p, k) > 0 ? num(p, k) : null);

const P = {
  nEstimators: (d = 200) => int('nEstimators', L('樹的數量', 'Number of trees'), d, 1, 5000, [100, 1000], L('越多越穩定但越慢。', 'More is more stable but slower.')),
  maxDepth: (d = 0) => int('maxDepth', L('最大深度（0 = 不限）', 'Max depth (0 = unlimited)'), d, 0, 64, [0, 16]),
  minLeaf: (d = 1) => int('minSamplesLeaf', L('葉節點最少樣本', 'Min samples per leaf'), d, 1, 1000, [1, 20], L('調大可降低過擬合。', 'Increase to reduce overfitting.')),
  maxFeatures: (d = 'sqrt') => enm('maxFeatures', L('每次分裂考慮的特徵', 'Features per split'), d, [['sqrt', L('√p', '√p')], ['log2', L('log₂ p', 'log₂ p')], ['1.0', L('全部', 'All')], ['0.5', L('一半', 'Half')]]),
  lr: (d = 0.1) => flt('learningRate', L('學習率', 'Learning rate'), d, 1e-4, 1, [0.01, 0.3], undefined, true),
  earlyStop: (d = 30) => int('earlyStopping', L('Early stopping 輪數（0 = 關）', 'Early-stopping rounds (0 = off)'), d, 0, 1000, [20, 100], L('驗證分數連續這麼多輪沒進步就停止，並使用最佳輪。', 'Stop when validation has not improved for this many rounds; keep the best iteration.')),
};
const mf = (p: ParamValues) => { const v = str(p, 'maxFeatures'); return v === 'sqrt' || v === 'log2' ? v : Number(v); };

export const SKLEARN_DEFS: SkDef[] = [
  {
    id: 'sk_linear', name: L('線性模型（L1 / L2 / ElasticNet）', 'Linear model (L1 / L2 / ElasticNet)'), family: 'linear', tasks: ALL, engines: SK,
    description: L('scikit-learn 的 LogisticRegression / ElasticNet。可調 L1、L2 混合比例。', 'scikit-learn LogisticRegression / ElasticNet with an adjustable L1/L2 mix.'),
    estimator: { cls: 'sklearn.linear_model.LogisticRegression', reg: 'sklearn.linear_model.ElasticNet' },
    params: [
      flt('alpha', L('正則化強度', 'Regularisation strength'), 0.01, 1e-6, 100, [1e-4, 1], L('分類時對應 C = 1/alpha。', 'For classification C = 1/alpha.'), true),
      flt('l1Ratio', L('L1 比例（0 = Ridge，1 = Lasso）', 'L1 ratio (0 = ridge, 1 = lasso)'), 0, 0, 1, [0, 1]),
      int('maxIter', L('最大迭代次數', 'Max iterations'), 1000, 10, 100000, [100, 5000]),
    ],
    kwargs: (p, c) => c.task === 'regression'
      ? { alpha: num(p, 'alpha'), l1_ratio: num(p, 'l1Ratio'), max_iter: num(p, 'maxIter'), random_state: c.seed }
      : { C: 1 / num(p, 'alpha'), l1_ratio: num(p, 'l1Ratio'), solver: 'saga', max_iter: num(p, 'maxIter'), random_state: c.seed },
  },
  {
    id: 'decision_tree', name: L('決策樹', 'Decision tree'), family: 'tree', tasks: ALL, engines: SK,
    description: L('單一 CART 樹，可解釋性高；容易過擬合，請限制深度。', 'A single CART tree; very interpretable, overfits easily — limit depth.'),
    estimator: { cls: 'sklearn.tree.DecisionTreeClassifier', reg: 'sklearn.tree.DecisionTreeRegressor' },
    params: [P.maxDepth(8), P.minLeaf(5)],
    kwargs: (p, c) => ({ max_depth: depthNone(p), min_samples_leaf: num(p, 'minSamplesLeaf'), random_state: c.seed }),
  },
  {
    id: 'random_forest', name: L('隨機森林', 'Random forest'), family: 'ensemble', tasks: ALL, engines: SK,
    description: L('多棵樹的 bagging 平均；預設值就很強，幾乎不需調參。', 'Bagged trees; strong out of the box with little tuning.'),
    estimator: { cls: 'sklearn.ensemble.RandomForestClassifier', reg: 'sklearn.ensemble.RandomForestRegressor' },
    params: [P.nEstimators(300), P.maxDepth(), P.minLeaf(), P.maxFeatures('sqrt')],
    taskDefaults: { regression: { maxFeatures: '1.0' } },
    kwargs: (p, c) => ({ n_estimators: num(p, 'nEstimators'), max_depth: depthNone(p), min_samples_leaf: num(p, 'minSamplesLeaf'), max_features: mf(p), random_state: c.seed, n_jobs: 1 }),
  },
  {
    id: 'extra_trees', name: L('ExtraTrees（極端隨機樹）', 'Extra trees'), family: 'ensemble', tasks: ALL, engines: SK,
    description: L('分裂點隨機選取，比隨機森林更快、變異更低。', 'Random split thresholds: faster than random forest, lower variance.'),
    estimator: { cls: 'sklearn.ensemble.ExtraTreesClassifier', reg: 'sklearn.ensemble.ExtraTreesRegressor' },
    params: [P.nEstimators(300), P.maxDepth(), P.minLeaf(), P.maxFeatures('sqrt')],
    taskDefaults: { regression: { maxFeatures: '1.0' } },
    kwargs: (p, c) => ({ n_estimators: num(p, 'nEstimators'), max_depth: depthNone(p), min_samples_leaf: num(p, 'minSamplesLeaf'), max_features: mf(p), random_state: c.seed, n_jobs: 1 }),
  },
  {
    id: 'adaboost', name: L('AdaBoost', 'AdaBoost'), family: 'ensemble', tasks: ALL, engines: SK,
    description: L('依序加權錯誤樣本的 boosting。', 'Boosting that re-weights misclassified samples.'),
    estimator: { cls: 'sklearn.ensemble.AdaBoostClassifier', reg: 'sklearn.ensemble.AdaBoostRegressor' },
    params: [P.nEstimators(100), P.lr(0.5)],
    kwargs: (p, c) => ({ n_estimators: num(p, 'nEstimators'), learning_rate: num(p, 'learningRate'), random_state: c.seed }),
  },
  {
    id: 'hist_gbdt', name: L('HistGradientBoosting', 'Histogram gradient boosting'), family: 'ensemble', tasks: ALL, engines: SK,
    description: L('scikit-learn 的直方圖 GBDT（LightGBM 風格），大資料也快。', 'scikit-learn histogram GBDT (LightGBM-style), fast on large data.'),
    estimator: { cls: 'sklearn.ensemble.HistGradientBoostingClassifier', reg: 'sklearn.ensemble.HistGradientBoostingRegressor' },
    params: [int('maxIter', L('迭代次數', 'Iterations'), 300, 10, 5000, [100, 1000]), P.lr(0.1), int('maxLeafNodes', L('每棵樹葉數', 'Leaves per tree'), 31, 2, 1024, [15, 127]), flt('l2', L('L2 正則化', 'L2 regularisation'), 0, 0, 100, [0, 1]), P.earlyStop(20)],
    kwargs: (p, c) => ({ max_iter: num(p, 'maxIter'), learning_rate: num(p, 'learningRate'), max_leaf_nodes: num(p, 'maxLeafNodes'), l2_regularization: num(p, 'l2'),
      early_stopping: num(p, 'earlyStopping') > 0, n_iter_no_change: Math.max(1, num(p, 'earlyStopping')), random_state: c.seed }),
  },
  {
    id: 'xgboost', name: L('XGBoost', 'XGBoost'), family: 'ensemble', tasks: ALL, engines: GB, fitKind: 'xgboost', iterParam: 'nEstimators',
    description: L('業界常用 GBDT；以驗證集 early stopping 並即時顯示學習曲線。', 'Industry-standard GBDT; validation early stopping with live learning curve.'),
    estimator: { cls: 'xgboost.XGBClassifier', reg: 'xgboost.XGBRegressor' },
    params: [P.nEstimators(500), int('maxDepth', L('最大深度', 'Max depth'), 6, 1, 16, [3, 10]), P.lr(0.05),
      flt('subsample', L('列抽樣比例', 'Row subsample'), 0.8, 0.1, 1, [0.6, 1]), flt('colsample', L('欄抽樣比例', 'Column subsample'), 0.8, 0.1, 1, [0.5, 1]),
      flt('lambda', L('L2 正則化（lambda）', 'L2 (lambda)'), 1, 0, 100, [0.1, 10], undefined, true), P.earlyStop(50)],
    kwargs: (p, c) => ({ n_estimators: num(p, 'nEstimators'), max_depth: num(p, 'maxDepth'), learning_rate: num(p, 'learningRate'), subsample: num(p, 'subsample'),
      colsample_bytree: num(p, 'colsample'), reg_lambda: num(p, 'lambda'), early_stopping_rounds: num(p, 'earlyStopping') || null, tree_method: 'hist', random_state: c.seed, n_jobs: 1 }),
  },
  {
    id: 'lightgbm', name: L('LightGBM', 'LightGBM'), family: 'ensemble', tasks: ALL, engines: GB, fitKind: 'lightgbm', iterParam: 'nEstimators',
    description: L('葉節點優先成長的 GBDT，速度快；以驗證集 early stopping。', 'Leaf-wise GBDT, very fast; validation early stopping.'),
    estimator: { cls: 'lightgbm.LGBMClassifier', reg: 'lightgbm.LGBMRegressor' },
    params: [P.nEstimators(500), int('numLeaves', L('每棵樹葉數', 'Leaves per tree'), 31, 2, 1024, [15, 127]), P.lr(0.05),
      int('minChildSamples', L('葉節點最少樣本', 'Min samples per leaf'), 20, 1, 1000, [5, 100]),
      flt('subsample', L('列抽樣比例', 'Row subsample'), 0.8, 0.1, 1, [0.6, 1]), flt('colsample', L('欄抽樣比例', 'Column subsample'), 0.8, 0.1, 1, [0.5, 1]),
      flt('lambda', L('L2 正則化', 'L2'), 0, 0, 100, [0, 10]), P.earlyStop(50)],
    kwargs: (p, c) => ({ n_estimators: num(p, 'nEstimators'), num_leaves: num(p, 'numLeaves'), learning_rate: num(p, 'learningRate'), min_child_samples: num(p, 'minChildSamples'),
      subsample: num(p, 'subsample'), subsample_freq: 1, colsample_bytree: num(p, 'colsample'), reg_lambda: num(p, 'lambda'), random_state: c.seed, n_jobs: 1, verbose: -1 }),
    fitKwargs: (p) => ({ early_stopping_rounds: num(p, 'earlyStopping') }),
  },
  {
    id: 'svm', name: L('支援向量機（SVM）', 'Support vector machine'), family: 'kernel', tasks: ALL, engines: SK,
    description: L('核方法；資料量 > 1 萬列時會很慢。分類輸出經 Platt scaling 的機率。', 'Kernel method; slow above ~10k rows. Classifier probabilities via Platt scaling.'),
    estimator: { cls: 'sklearn.svm.SVC', reg: 'sklearn.svm.SVR' },
    params: [flt('C', L('C（懲罰）', 'C (penalty)'), 1, 1e-4, 1e4, [0.1, 100], undefined, true),
      enm('kernel', L('核函數', 'Kernel'), 'rbf', [['rbf', L('RBF', 'RBF')], ['linear', L('線性', 'Linear')], ['poly', L('多項式', 'Polynomial')]]),
      enm('gamma', L('gamma', 'gamma'), 'scale', [['scale', L('scale', 'scale')], ['auto', L('auto', 'auto')]])],
    kwargs: (p, c) => c.task === 'regression'
      ? { C: num(p, 'C'), kernel: str(p, 'kernel'), gamma: str(p, 'gamma') }
      : { C: num(p, 'C'), kernel: str(p, 'kernel'), gamma: str(p, 'gamma'), probability: true, random_state: c.seed },
  },
  {
    id: 'knn', name: L('k 近鄰（kNN）', 'k-nearest neighbours'), family: 'neighbors', tasks: ALL, engines: SK,
    description: L('以最近的 k 筆樣本投票 / 平均。特徵已標準化。', 'Votes / averages over the k nearest samples (features are standardised).'),
    estimator: { cls: 'sklearn.neighbors.KNeighborsClassifier', reg: 'sklearn.neighbors.KNeighborsRegressor' },
    params: [int('k', L('k（鄰居數）', 'k (neighbours)'), 15, 1, 500, [5, 50]), enm('weights', L('權重', 'Weights'), 'distance', [['uniform', L('相同', 'Uniform')], ['distance', L('依距離', 'By distance')]])],
    kwargs: (p) => ({ n_neighbors: num(p, 'k'), weights: str(p, 'weights') }),
  },
  {
    id: 'naive_bayes', name: L('高斯 Naive Bayes', 'Gaussian naive Bayes'), family: 'bayes', tasks: CLS, engines: SK,
    description: L('假設特徵條件獨立的機率模型，極快，適合當基準。', 'Probabilistic model assuming conditional independence; very fast baseline.'),
    estimator: { cls: 'sklearn.naive_bayes.GaussianNB' },
    params: [flt('varSmoothing', L('變異數平滑', 'Variance smoothing'), 1e-9, 1e-12, 1, [1e-10, 1e-6], undefined, true)],
    kwargs: (p) => ({ var_smoothing: num(p, 'varSmoothing') }),
  },
  {
    id: 'lda', name: L('線性判別分析（LDA）', 'Linear discriminant analysis'), family: 'linear', tasks: CLS, engines: SK,
    description: L('各類別共用共變異矩陣的高斯模型。', 'Gaussian classes with a shared covariance.'),
    estimator: { cls: 'sklearn.discriminant_analysis.LinearDiscriminantAnalysis' },
    params: [flt('shrinkage', L('收縮（0 = 無）', 'Shrinkage (0 = none)'), 0, 0, 1, [0, 0.5])],
    kwargs: (p) => (num(p, 'shrinkage') > 0 ? { solver: 'lsqr', shrinkage: num(p, 'shrinkage') } : {}),
  },
  {
    id: 'qda', name: L('二次判別分析（QDA）', 'Quadratic discriminant analysis'), family: 'bayes', tasks: CLS, engines: SK,
    description: L('每個類別有自己的共變異矩陣。', 'Each class has its own covariance.'),
    estimator: { cls: 'sklearn.discriminant_analysis.QuadraticDiscriminantAnalysis' },
    params: [flt('regParam', L('正則化', 'Regularisation'), 0.01, 0, 1, [0, 0.1])],
    kwargs: (p) => ({ reg_param: num(p, 'regParam') }),
  },
  {
    id: 'gaussian_process', name: L('高斯過程', 'Gaussian process'), family: 'kernel', tasks: ALL, engines: SK,
    description: L('非參數貝氏模型，迴歸可給不確定性；O(n³)，建議 < 3000 列。', 'Non-parametric Bayesian model; O(n³) — keep below ~3000 rows.'),
    estimator: { cls: 'sklearn.gaussian_process.GaussianProcessClassifier', reg: 'sklearn.gaussian_process.GaussianProcessRegressor' },
    params: [int('restarts', L('核參數最佳化重啟次數', 'Optimizer restarts'), 0, 0, 10, [0, 3])],
    kwargs: (p, c) => (c.task === 'regression'
      ? { n_restarts_optimizer: num(p, 'restarts'), normalize_y: true, random_state: c.seed }
      : { n_restarts_optimizer: num(p, 'restarts'), random_state: c.seed }),
  },
];
