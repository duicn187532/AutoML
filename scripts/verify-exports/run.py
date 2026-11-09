"""Windows/Linux parity check: library reference → JavaScript portable → ONNX Runtime."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[2]
npx = shutil.which('npx.cmd') or shutil.which('npx')
if npx is None:
    raise SystemExit('npx is required; install Node.js and npm first')
with tempfile.TemporaryDirectory(prefix='aml-exports-') as dirname:
    subprocess.run([sys.executable, str(root / 'scripts/verify-exports/make_cases.py'), dirname], cwd=root, check=True)
    env = dict(os.environ, ONNX_DIR=dirname)
    subprocess.run([npx, 'vitest', 'run', 'tests/exports.check.test.ts'], cwd=root, env=env, check=True)
    subprocess.run([sys.executable, str(root / 'scripts/verify-exports/compare.py'), dirname], cwd=root, check=True)
print('Export prediction parity PASS (14 cases, reference/JS/ONNX)')
