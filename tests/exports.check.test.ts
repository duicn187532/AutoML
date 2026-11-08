import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { portableToOnnx } from '@/core/export/onnx';
import { amlEvalModel } from '@/core/export/runtime.js';
const dir = process.env.ONNX_DIR!;
it.skipIf(!dir)('writes onnx + js-runtime predictions (scripts/verify-exports/run.sh)', () => {
  const cases = JSON.parse(readFileSync(`${dir}/cases.json`, 'utf8'));
  const js: Record<string, unknown> = {};
  for (const [k, c] of Object.entries<{ model: never; X: number[][]; nClasses: number }>(cases)) {
    writeFileSync(`${dir}/${k}.onnx`, portableToOnnx(c.model, c.X[0].length, c.nClasses));
    js[k] = c.X.map((x) => amlEvalModel(c.model, x, c.nClasses));
  }
  writeFileSync(`${dir}/js.json`, JSON.stringify(js));
});
