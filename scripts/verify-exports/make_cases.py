import json, os, sys, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/core/engines/py'))
import aml_bridge as B
from sklearn.datasets import make_classification, make_regression
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier, RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.linear_model import LogisticRegression, Ridge
from xgboost import XGBClassifier, XGBRegressor
from lightgbm import LGBMClassifier, LGBMRegressor
Xc, yc = make_classification(300, 6, n_informative=4, n_classes=3, random_state=0)
Xb, yb = make_classification(300, 6, random_state=1)
Xr, yr = make_regression(300, 6, random_state=2)
cases = {
 'rf3': (RandomForestClassifier(20, max_depth=5, random_state=0), Xc, yc), 'hgb3': (HistGradientBoostingClassifier(max_iter=30), Xc, yc),
 'hgb2': (HistGradientBoostingClassifier(max_iter=30), Xb, yb), 'xgb3': (XGBClassifier(n_estimators=30, max_depth=3), Xc, yc),
 'xgb2': (XGBClassifier(n_estimators=30, max_depth=3), Xb, yb), 'lgb3': (LGBMClassifier(n_estimators=30, verbose=-1), Xc, yc),
 'lgb2': (LGBMClassifier(n_estimators=30, verbose=-1), Xb, yb), 'lin3': (LogisticRegression(max_iter=500), Xc, yc), 'lin2': (LogisticRegression(), Xb, yb),
 'rfr': (RandomForestRegressor(20, max_depth=5, random_state=0), Xr, yr), 'hgbr': (HistGradientBoostingRegressor(max_iter=30), Xr, yr),
 'xgbr': (XGBRegressor(n_estimators=30), Xr, yr), 'lgbr': (LGBMRegressor(n_estimators=30, verbose=-1), Xr, yr), 'ridge': (Ridge(), Xr, yr),
}
out = {}
for k, (m, X, y) in cases.items():
    m.fit(X, y)
    mid = B._register(m)
    port = json.loads(B.export_portable(mid))
    ref = m.predict_proba(X[:50]) if hasattr(m, 'predict_proba') else m.predict(X[:50])
    out[k] = {'model': port, 'X': X[:50].tolist(), 'ref': np.asarray(ref).tolist(), 'nClasses': len(set(y)) if hasattr(m, 'predict_proba') else 0}
json.dump(out, open(os.path.join(sys.argv[1], 'cases.json'), 'w'))
print('cases', len(out))
