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


def make(path, kwargs_json):
    mod, cls = path.rsplit(".", 1)
    est = getattr(importlib.import_module(mod), cls)(**json.loads(kwargs_json))
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
