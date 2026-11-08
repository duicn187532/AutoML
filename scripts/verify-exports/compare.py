"""Compare ONNX Runtime and the JS runtime against the libraries' own predictions."""
import json, os, sys
import numpy as np
import onnxruntime as ort

d = sys.argv[1]
cases = json.load(open(os.path.join(d, 'cases.json'))); js = json.load(open(os.path.join(d, 'js.json')))
bad = 0
for k, c in cases.items():
    ref = np.asarray(c['ref']); X = np.asarray(c['X'], dtype=np.float32)
    o = ort.InferenceSession(os.path.join(d, f'{k}.onnx')).run(None, {'features': X})[0]
    s = max(1.0, float(np.abs(ref).max()))
    eo, ej = float(np.abs(o.reshape(ref.shape) - ref).max()) / s, float(np.abs(np.asarray(js[k]).reshape(ref.shape) - ref).max()) / s
    bad += eo > 1e-5 or ej > 1e-5
    print('%-6s onnx %.1e  js %.1e' % (k, eo, ej))
sys.exit(1 if bad else 0)
