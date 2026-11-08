// M0 benchmarks on the BUILT app via file:// (Chromium). Prints a JSON report.
// Usage: npm run build && node scripts/m0/benchmark.mjs [--quick]
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = (await import('/opt/node-tools/node_modules/playwright/index.js')).default; }
const quick = process.argv.includes('--quick');

const browser = await playwright.chromium.launch({ args: ['--enable-unsafe-webgpu'] });
const page = await browser.newPage();
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
page.on('pageerror', (e) => problems.push(e.message));
await page.goto(pathToFileURL(resolve('dist/index.html')).href + '#aml-debug');
await page.waitForFunction(() => window.__aml);

const run = (spec) => page.evaluate(async ({ spec }) => {
  const { pool } = window.__aml;
  const t0 = performance.now();
  try {
    const r = await pool.submit({ kind: 'benchmark', input: spec.input }, { label: 'bench', engines: spec.engines }).result;
    return { ...r, wallMs: Math.round(performance.now() - t0) };
  } catch (e) { return { error: String(e.message ?? e), input: spec.input }; }
}, { spec });

const report = { browser: browser.version(), when: new Date().toISOString(), engineLoad: {}, results: [] };
// Engine load (main thread: script chunks + base64 decode + sha256)
report.engineLoad = await page.evaluate(async () => {
  const out = {};
  for (const n of ['tfjs', 'pyodide', 'py-sklearn', 'py-gbdt']) {
    const t0 = performance.now();
    const e = await window.__aml.engineLoader.load(n);
    out[n] = { ms: Math.round(performance.now() - t0), MB: +(e.manifest.totalBytes / 2 ** 20).toFixed(1) };
  }
  return out;
});
console.error('engine load', JSON.stringify(report.engineLoad));

// First Pyodide task in a fresh worker = startup (import + wheel install) + tiny fit
const startup = await run({ engines: ['pyodide', 'py-sklearn', 'py-gbdt'], input: { pluginId: 'decision_tree', rows: 200, cols: 5, task: 'binary' } });
report.pyodideStartupMs = startup.wallMs;
report.results.push(startup);
console.error('startup', JSON.stringify(startup));

const sizes = quick ? [10_000] : [10_000, 100_000, 500_000];
for (const rows of sizes) {
  for (const pluginId of ['xgboost', 'lightgbm', 'hist_gbdt']) {
    const r = await run({ engines: ['pyodide', 'py-sklearn', 'py-gbdt'], input: { pluginId, rows, cols: 20, task: 'binary', params: { nEstimators: 200, maxIter: 200, earlyStopping: 0 } } });
    report.results.push(r);
    console.error(pluginId, rows, JSON.stringify(r));
  }
}
for (const tfBackend of ['cpu', 'webgl', 'webgpu']) {
  const r = await run({ engines: ['tfjs'], input: { pluginId: 'mlp', rows: 10_000, cols: 20, task: 'binary', tfBackend, params: { epochs: 5, batchSize: 256, patience: 0 } } });
  report.results.push(r);
  console.error('mlp', tfBackend, JSON.stringify(r));
}
report.problems = problems;
console.log(JSON.stringify(report, null, 2));
await browser.close();
