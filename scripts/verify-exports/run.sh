#!/usr/bin/env bash
# Export-correctness check (needs: pip install scikit-learn xgboost lightgbm onnx onnxruntime).
set -euo pipefail
D=$(mktemp -d)
python3 "$(dirname "$0")/make_cases.py" "$D"
ONNX_DIR="$D" npx vitest run tests/exports.check.test.ts
python3 "$(dirname "$0")/compare.py" "$D"
