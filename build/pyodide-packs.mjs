// Pyodide package groups → one engine pack each. Later groups exclude wheels already in earlier
// groups (they declare those engines as dependencies), so nothing is shipped twice.
export const PY_PACK_GROUPS = [
  { engine: 'py-sklearn', roots: ['numpy', 'scipy', 'scikit-learn'], deps: ['pyodide'] },
  { engine: 'py-gbdt', roots: ['xgboost', 'lightgbm'], deps: ['pyodide', 'py-sklearn'] },
  { engine: 'py-stats', roots: ['pandas', 'statsmodels'], deps: ['pyodide', 'py-sklearn'] },
  { engine: 'py-plot', roots: ['matplotlib'], deps: ['pyodide', 'py-sklearn'] },
];
