"""Bridge between the workbench (JS) and Python estimators running in Pyodide.

Models live in a registry keyed by integer id; JS only holds the id. Arrays cross the
boundary as raw float64 bytes (no per-element conversion).
"""
import importlib
import json
import pickle

import numpy as np
from sklearn.base import is_classifier

_models = {}
_next_id = [0]


def _mat(buf, rows, cols):
    a = np.frombuffer(bytes(buf.to_py()), dtype=np.float64)
    return a.reshape(rows, cols) if cols else a


def _register(model):
    _next_id[0] += 1
    _models[_next_id[0]] = model
    return _next_id[0]


def _kernel(name):
    from sklearn.gaussian_process.kernels import RBF, ConstantKernel, WhiteKernel
    if name == "rbf_white":
        return ConstantKernel(1.0) * RBF(length_scale=1.0) + WhiteKernel(noise_level=0.1)
    raise ValueError(f"unknown kernel {name}")


def make(path, kwargs_json):
    mod, cls = path.rsplit(".", 1)
    kwargs = json.loads(kwargs_json)
    for k, v in list(kwargs.items()):
        if isinstance(v, dict) and "$kernel" in v:
            kwargs[k] = _kernel(v["$kernel"])
    est = getattr(importlib.import_module(mod), cls)(**kwargs)
    return _register(est)


def _xgb_callback(progress):
    import xgboost as xgb

    class _Progress(xgb.callback.TrainingCallback):
        def after_iteration(self, model, epoch, evals_log):
            point = {"epoch": epoch + 1}
            for key, name in (("validation_0", "loss"), ("validation_1", "val_loss")):
                metrics = evals_log.get(key)
                if metrics:
                    point[name] = float(list(metrics.values())[0][-1])
            progress(json.dumps(point))
            return False

    return _Progress()


def _lgb_callback(progress):
    def _cb(env):
        point = {"epoch": env.iteration + 1}
        for data_name, _metric, value, _hib in env.evaluation_result_list:
            point["loss" if data_name == "train" else "val_loss"] = float(value)
        progress(json.dumps(point))

    _cb.order = 30
    return _cb


def fit(mid, kind, X, rows, cols, y, Xv, vrows, yv, progress, fit_kwargs_json):
    """kind: 'plain' | 'xgboost' | 'lightgbm'. Returns JSON with history / notes."""
    m = _models[mid]
    X = _mat(X, rows, cols)
    y = _mat(y, rows, 0)
    cls = is_classifier(m)
    if cls:
        y = y.astype(np.int64)
    has_valid = vrows > 0
    if has_valid:
        Xv = _mat(Xv, vrows, cols)
        yv = _mat(yv, vrows, 0)
        if cls:
            yv = yv.astype(np.int64)
    fit_kwargs = json.loads(fit_kwargs_json)
    out = {"notes": []}
    if kind == "xgboost":
        m.set_params(callbacks=[_xgb_callback(progress)])
        if not has_valid:
            m.set_params(early_stopping_rounds=None)
        evals = [(X, y)] + ([(Xv, yv)] if has_valid else [])
        m.fit(X, y, eval_set=evals, verbose=False)
        m.set_params(callbacks=None)
        if getattr(m, "best_iteration", None) is not None:
            out["bestEpoch"] = int(m.best_iteration) + 1
    elif kind == "lightgbm":
        import lightgbm as lgb

        callbacks = [_lgb_callback(progress)]
        rounds = fit_kwargs.pop("early_stopping_rounds", 0)
        if has_valid and rounds:
            callbacks.append(lgb.early_stopping(rounds, verbose=False))
        evals = [(X, y)] + ([(Xv, yv)] if has_valid else [])
        names = ["train"] + (["valid"] if has_valid else [])
        m.fit(X, y, eval_set=evals, eval_names=names, callbacks=callbacks)
        if getattr(m, "best_iteration_", None):
            out["bestEpoch"] = int(m.best_iteration_)
    else:
        m.fit(X, y)
    if hasattr(m, "n_iter_"):
        out["notes"].append(f"n_iter={np.ravel(m.n_iter_).tolist()}")
    return json.dumps(out)


def predict(mid, X, rows, cols):
    return np.asarray(_models[mid].predict(_mat(X, rows, cols)), dtype=np.float64).ravel().tobytes()


def predict_proba(mid, X, rows, cols, n_classes):
    m = _models[mid]
    p = np.asarray(m.predict_proba(_mat(X, rows, cols)), dtype=np.float64)
    full = np.zeros((p.shape[0], n_classes), dtype=np.float64)
    full[:, np.asarray(m.classes_, dtype=np.int64)] = p  # classes absent in training get probability 0
    return full.ravel().tobytes()


def feature_importances(mid):
    m = _models[mid]
    imp = getattr(m, "feature_importances_", None)
    if imp is None and hasattr(m, "coef_"):
        imp = np.abs(np.atleast_2d(m.coef_)).mean(axis=0)
    return None if imp is None else np.asarray(imp, dtype=np.float64).tobytes()


def dump(mid):
    return pickle.dumps(_models[mid], protocol=5)


def load(buf):
    return _register(pickle.loads(bytes(buf.to_py())))


def free(mid):
    _models.pop(mid, None)


# ---------------------------------------------------------------- portable export (M8)

def _sk_tree(t, classifier):
    tr = t.tree_
    vals = tr.value[:, 0, :] if classifier else tr.value[:, 0, :1]
    if classifier:
        s = vals.sum(axis=1, keepdims=True)
        s[s == 0] = 1
        vals = vals / s
    return {
        "feature": tr.feature.tolist(),
        "threshold": tr.threshold.tolist(),
        "left": tr.children_left.tolist(),
        "right": tr.children_right.tolist(),
        "value": vals.tolist(),
    }


def _xgb(m):
    booster = m.get_booster()
    raw = json.loads(booster.save_raw("json"))
    learner = raw["learner"]
    gb = learner["gradient_booster"]["model"]
    trees = []
    for t in gb["trees"]:
        trees.append({
            "feature": t["split_indices"],
            "threshold": t["split_conditions"],
            "left": t["left_children"],
            "right": t["right_children"],
            "value": [[w] for w in t["base_weights"]],
            "leaf": [l == -1 for l in t["left_children"]],
        })
    info = gb.get("tree_info", [0] * len(trees))
    base = learner["learner_model_param"]["base_score"]
    # XGBoost ≥ 3 stores a vector (per-class intercepts, margin space for softprob); 2.x a scalar
    base = [float(v) for v in base.strip("[]").split(",")] if isinstance(base, str) else [float(base)]
    best = getattr(m, "best_iteration", None)
    return {"trees": trees, "treeClass": info, "baseScore": base, "objective": learner["objective"]["name"], "bestIteration": best}


def _lgb(m):
    dump = m.booster_.dump_model()
    trees = []
    for ti in dump["tree_info"]:
        feature, threshold, left, right, value, leaf = [], [], [], [], [], []

        def walk(node):
            i = len(feature)
            feature.append(-1); threshold.append(0.0); left.append(-1); right.append(-1); value.append([0.0]); leaf.append(True)
            if "split_index" in node:
                feature[i] = node["split_feature"]
                threshold[i] = float(node["threshold"])
                leaf[i] = False
                left[i] = walk(node["left_child"])
                right[i] = walk(node["right_child"])
            else:
                value[i] = [float(node["leaf_value"])]
            return i

        walk(ti["tree_structure"])
        trees.append({"feature": feature, "threshold": threshold, "left": left, "right": right, "value": value, "leaf": leaf})
    k = dump.get("num_tree_per_iteration", 1)
    best = getattr(m, "best_iteration_", None) or None
    return {"trees": trees, "treeClass": [i % k for i in range(len(trees))], "objective": dump.get("objective", ""), "perIteration": k, "bestIteration": best}


def _hgb(m):
    trees, cls = [], []
    for it in m._predictors:
        for k, p in enumerate(it):
            n = p.nodes
            trees.append({
                "feature": n["feature_idx"].tolist(),
                "threshold": n["num_threshold"].tolist(),
                "left": n["left"].tolist(),
                "right": n["right"].tolist(),
                "value": [[float(v)] for v in n["value"]],
                "leaf": n["is_leaf"].astype(bool).tolist(),
            })
            cls.append(k)
    base = np.ravel(m._baseline_prediction).tolist()
    return {"trees": trees, "treeClass": cls, "baseline": base, "loss": type(m._loss).__name__}


def export_portable(mid):
    """Return JSON for models with a pure-JS evaluator, else None."""
    m = _models[mid]
    name = type(m).__name__
    clf = is_classifier(m)
    if name in ("DecisionTreeClassifier", "DecisionTreeRegressor"):
        return json.dumps({"kind": "forest", "classifier": clf, "trees": [_sk_tree(m, clf)], "classes": np.asarray(getattr(m, "classes_", [])).tolist()})
    if name in ("RandomForestClassifier", "RandomForestRegressor", "ExtraTreesClassifier", "ExtraTreesRegressor"):
        return json.dumps({"kind": "forest", "classifier": clf, "trees": [_sk_tree(t, clf) for t in m.estimators_], "classes": np.asarray(getattr(m, "classes_", [])).tolist()})
    if name in ("XGBClassifier", "XGBRegressor"):
        return json.dumps({"kind": "xgboost", "classifier": clf, "classes": np.asarray(getattr(m, "classes_", [])).tolist(), **_xgb(m)})
    if name in ("LGBMClassifier", "LGBMRegressor"):
        return json.dumps({"kind": "lightgbm", "classifier": clf, "classes": np.asarray(getattr(m, "classes_", [])).tolist(), **_lgb(m)})
    if name in ("HistGradientBoostingClassifier", "HistGradientBoostingRegressor"):
        return json.dumps({"kind": "hgb", "classifier": clf, "classes": np.asarray(getattr(m, "classes_", [])).tolist(), **_hgb(m)})
    if name in ("LogisticRegression", "ElasticNet", "Ridge", "LinearRegression", "Lasso"):
        coef = np.atleast_2d(m.coef_)
        return json.dumps({"kind": "linear", "classifier": clf, "W": coef.T.tolist(), "b": np.atleast_1d(m.intercept_).tolist(), "classes": np.asarray(getattr(m, "classes_", [])).tolist()})
    return None


# ---------------------------------------------------------------- unsupervised (M3)

def unsupervised(method, params_json, X, rows, cols, seed):
    """Clustering / dimensionality reduction / anomaly detection on an encoded matrix."""
    from sklearn import cluster, decomposition, ensemble, manifold, mixture, neighbors
    from sklearn.metrics import silhouette_score

    p = json.loads(params_json)
    X = _mat(X, rows, cols)
    out = {"method": method}
    rng = np.random.RandomState(seed)

    def embed2(Z):
        if Z.shape[1] <= 2:
            return np.pad(Z, ((0, 0), (0, 2 - Z.shape[1])))
        return decomposition.PCA(n_components=2, random_state=seed).fit_transform(Z)

    if method in ("kmeans", "dbscan", "agglomerative", "gmm"):
        if method == "kmeans":
            m = cluster.KMeans(n_clusters=int(p["k"]), n_init=10, random_state=seed)
            labels = m.fit_predict(X)
            out["inertia"] = float(m.inertia_)
        elif method == "dbscan":
            labels = cluster.DBSCAN(eps=float(p["eps"]), min_samples=int(p["minSamples"])).fit_predict(X)
        elif method == "agglomerative":
            labels = cluster.AgglomerativeClustering(n_clusters=int(p["k"]), linkage=p.get("linkage", "ward")).fit_predict(X)
        else:
            m = mixture.GaussianMixture(n_components=int(p["k"]), covariance_type=p.get("covariance", "full"), random_state=seed)
            labels = m.fit_predict(X)
            out["bic"] = float(m.bic(X))
        labels = np.asarray(labels)
        valid = labels >= 0
        n_clusters = len(set(labels[valid].tolist()))
        if n_clusters >= 2 and valid.sum() > n_clusters:
            idx = np.where(valid)[0]
            if len(idx) > 5000:
                idx = rng.choice(idx, 5000, replace=False)
            out["silhouette"] = float(silhouette_score(X[idx], labels[idx]))
        out["labels"] = labels.tolist()
        out["nClusters"] = n_clusters
        out["noise"] = int((~valid).sum())
        out["embedding"] = embed2(X).ravel().tolist()
    elif method in ("pca", "tsne"):
        k = int(p.get("components", 2))
        if method == "pca":
            m = decomposition.PCA(n_components=min(k, cols), random_state=seed)
            Z = m.fit_transform(X)
            out["explainedVariance"] = m.explained_variance_ratio_.tolist()
        else:
            Z = manifold.TSNE(n_components=2, perplexity=float(p.get("perplexity", 30)), random_state=seed, init="pca").fit_transform(X)
        out["components"] = Z.tolist()
        out["embedding"] = embed2(Z[:, :2] if Z.shape[1] >= 2 else Z).ravel().tolist()
    elif method in ("isolation_forest", "lof"):
        if method == "isolation_forest":
            m = ensemble.IsolationForest(n_estimators=int(p.get("trees", 200)), contamination=float(p["contamination"]), random_state=seed)
            labels = m.fit_predict(X)
            scores = -m.score_samples(X)
        else:
            m = neighbors.LocalOutlierFactor(n_neighbors=int(p.get("neighbors", 20)), contamination=float(p["contamination"]))
            labels = m.fit_predict(X)
            scores = -m.negative_outlier_factor_
        out["anomaly"] = (labels == -1).astype(int).tolist()
        out["scores"] = np.asarray(scores, dtype=float).tolist()
        out["embedding"] = embed2(X).ravel().tolist()
    else:
        raise ValueError(f"unknown method {method}")
    return json.dumps(out)


# ---------------------------------------------------------------- forecasting (M3 time series)

def forecast(method, params_json, y_buf, n, horizon, holdout):
    """ARIMA / ETS on a regularly spaced series. Returns holdout metrics and a future forecast."""
    import warnings

    from statsmodels.tsa.arima.model import ARIMA
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    p = json.loads(params_json)
    y = _mat(y_buf, n, 0)

    def fit_predict(train, steps):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            if method == "arima":
                seasonal = (int(p.get("P", 0)), int(p.get("D", 0)), int(p.get("Q", 0)), int(p.get("season", 0))) if int(p.get("season", 0)) > 1 else (0, 0, 0, 0)
                res = ARIMA(train, order=(int(p["p"]), int(p["d"]), int(p["q"])), seasonal_order=seasonal).fit()
                fc = res.get_forecast(steps)
                ci = fc.conf_int(alpha=0.05)
                return np.asarray(fc.predicted_mean), np.asarray(ci)[:, 0], np.asarray(ci)[:, 1], float(res.aic)
            season = int(p.get("season", 0))
            res = ExponentialSmoothing(train, trend=None if p.get("trend", "add") == "none" else p.get("trend", "add"),
                                       seasonal=None if season < 2 or p.get("seasonal", "add") == "none" else p.get("seasonal", "add"),
                                       seasonal_periods=season if season >= 2 else None).fit()
            mean = np.asarray(res.forecast(steps))
            sd = np.std(res.resid) if len(res.resid) else 0.0
            h = np.arange(1, steps + 1)
            return mean, mean - 1.96 * sd * np.sqrt(h), mean + 1.96 * sd * np.sqrt(h), float(getattr(res, "aic", np.nan))

    out = {"method": method}
    if holdout > 0 and n - holdout > 5:
        pred, lo, hi, _ = fit_predict(y[:-holdout], holdout)
        actual = y[-holdout:]
        err = actual - pred
        out["holdout"] = {"pred": pred.tolist(), "lo": lo.tolist(), "hi": hi.tolist(),
                          "mae": float(np.mean(np.abs(err))), "rmse": float(np.sqrt(np.mean(err ** 2))),
                          "mape": float(np.mean(np.abs(err) / np.maximum(np.abs(actual), 1e-12)))}
    pred, lo, hi, aic = fit_predict(y, horizon)
    out["forecast"] = {"pred": pred.tolist(), "lo": lo.tolist(), "hi": hi.tolist()}
    out["aic"] = aic
    return json.dumps(out)


def contributions(mid, X, rows, cols):
    """TreeSHAP contributions (XGBoost / LightGBM): rows × (cols + 1) per output, flattened; None otherwise."""
    m = _models[mid]
    name = type(m).__name__
    X = _mat(X, rows, cols)
    if name in ("XGBClassifier", "XGBRegressor"):
        import xgboost as xgb

        c = m.get_booster().predict(xgb.DMatrix(X), pred_contribs=True)
    elif name in ("LGBMClassifier", "LGBMRegressor"):
        c = m.predict(X, pred_contrib=True)
    else:
        return None
    c = np.asarray(c, dtype=np.float64)
    return json.dumps({"shape": list(c.shape), "values": c.ravel().tolist()})
