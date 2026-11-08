"""Script-mode kernel for the workbench (runs inside Pyodide in the worker).

`aml` is available in every cell:
    aml.datasets()                 -> names of datasets passed to this cell
    aml.load(name)                 -> pandas.DataFrame
    aml.save_dataset(df, name)     -> adds a dataset to the workbench project
Matplotlib figures created in a cell are returned as PNG images.
"""
import ast
import base64
import io
import json
import os
import sys
import traceback

os.environ.setdefault("MPLBACKEND", "Agg")

_namespaces = {}
_tables = {}
_saved = []


class _Aml:
    def datasets(self):
        return sorted(_tables)

    def load(self, name):
        import pandas as pd

        if name not in _tables:
            raise KeyError(f"dataset {name!r} not available; call aml.datasets() — reference it literally as aml.load('{name}') so the workbench sends it")
        return pd.DataFrame(_tables[name])

    def save_dataset(self, df, name):
        _saved.append((str(name), df))
        return f"saved dataset {name!r} ({len(df)} rows)"


aml = _Aml()


def put_column(table, column, values, numeric):
    import numpy as np

    cols = _tables.setdefault(table, {})
    if numeric:
        cols[column] = np.frombuffer(bytes(values.to_py()), dtype=np.float64).copy()
    else:
        cols[column] = list(values.to_py())


def reset(session):
    _namespaces.pop(session, None)


def _figures():
    if "matplotlib.pyplot" not in sys.modules:
        return []
    import matplotlib.pyplot as plt

    out = []
    for num in plt.get_fignums():
        buf = io.BytesIO()
        plt.figure(num).savefig(buf, format="png", dpi=110, bbox_inches="tight")
        out.append(base64.b64encode(buf.getvalue()).decode())
    plt.close("all")
    return out


def _df_to_columns(df):
    import numpy as np
    import pandas as pd

    df = pd.DataFrame(df)
    cols = []
    for name in df.columns:
        s = df[name]
        if pd.api.types.is_bool_dtype(s):
            s = s.astype(str)
        if pd.api.types.is_numeric_dtype(s):
            cols.append({"name": str(name), "numeric": True, "values": [None if v != v else float(v) for v in s.to_numpy(dtype=np.float64)]})
        else:
            cols.append({"name": str(name), "numeric": False, "values": [None if (v is None or (isinstance(v, float) and v != v)) else str(v) for v in s.tolist()]})
    return {"rowCount": int(len(df)), "columns": cols}


async def run_cell(session, code):
    ns = _namespaces.setdefault(session, {"__name__": "__main__", "aml": aml})
    out, err = io.StringIO(), io.StringIO()
    result = None
    error = None
    old = sys.stdout, sys.stderr
    sys.stdout, sys.stderr = out, err
    _saved.clear()
    try:
        tree = ast.parse(code, mode="exec")
        last = tree.body[-1] if tree.body and isinstance(tree.body[-1], ast.Expr) else None
        if last is not None:
            tree.body = tree.body[:-1]
        flags = ast.PyCF_ALLOW_TOP_LEVEL_AWAIT
        r = eval(compile(tree, "<cell>", "exec", flags=flags), ns)
        if r is not None and hasattr(r, "__await__"):
            await r
        if last is not None:
            v = eval(compile(ast.Expression(last.value), "<cell>", "eval", flags=flags), ns)
            if v is not None and hasattr(v, "__await__"):
                v = await v
            if v is not None:
                result = (v.head(50).to_string() if hasattr(v, "head") and hasattr(v, "to_string") else repr(v))[:20000]
    except BaseException:  # noqa: BLE001 — report everything to the user
        error = traceback.format_exc(limit=-6)
    finally:
        sys.stdout, sys.stderr = old
    saved = [{"name": n, "table": _df_to_columns(df)} for n, df in _saved]
    _saved.clear()
    return json.dumps({
        "stdout": out.getvalue()[-50000:],
        "stderr": err.getvalue()[-20000:],
        "result": result,
        "error": error,
        "images": _figures(),
        "saved": saved,
    })
