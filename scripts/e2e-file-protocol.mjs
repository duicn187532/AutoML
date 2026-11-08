// End-to-end check of the BUILT app opened via file:// with the network disabled (Chromium).
// Usage: npm run build && npm run e2e   (optional: --shots <dir> to save screenshots)
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = (await import('/opt/node-tools/node_modules/playwright/index.js')).default; }

const dist = resolve('dist/index.html');
if (!existsSync(dist)) { console.error('dist/index.html missing — run `npm run build` first'); process.exit(1); }
const shotsArg = process.argv.indexOf('--shots');
const shots = shotsArg > 0 ? resolve(process.argv[shotsArg + 1]) : null;
if (shots) mkdirSync(shots, { recursive: true });
const only = process.argv.includes('--quick') ? new Set(['core']) : null;

const url = pathToFileURL(dist).href + '#aml-debug';
const profile = mkdtempSync(join(tmpdir(), 'aml-e2e-'));
const problems = [];
const T = 300_000;
const t0 = Date.now();
const step = (name) => console.log(`• [${Math.round((Date.now() - t0) / 1000)}s] ${name}`);
const shot = async (page, name) => { if (shots) await page.screenshot({ path: join(shots, `${name}.png`), fullPage: true }); };

const ctx = await playwright.chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await ctx.setOffline(true);
await ctx.addInitScript(() => {
  try { localStorage.setItem('aml.tutorialSeen', '1'); } catch { /* ignore */ }
  document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`));
});
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => { if (!r.url().startsWith('blob:')) problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });

/** Wait for the newest task to finish; fail fast with its error. */
async function waitTask() {
  await page.waitForFunction(() => {
    const t = document.querySelector('[data-testid=task]');
    return t && !['running', 'queued'].includes(t.getAttribute('data-status'));
  }, null, { timeout: T });
  const t = page.getByTestId('task').first();
  const status = await t.getAttribute('data-status');
  if (status !== 'done') throw new Error(`task ${status}: ${await t.innerText()}`);
}
const metric = async (name) => (await page.getByTestId(`metric-${name}`).first().locator('.metric-value').innerText()).trim();

try {
  step('open via file:// (offline) and load a sample');
  await page.goto(url);
  await page.getByTestId('sample-select').selectOption('collateral-cls');
  await page.getByTestId('dataset-item').first().waitFor();
  await page.getByTestId('quality-report').waitFor({ timeout: T });
  if ((await page.getByTestId('columns-table').locator('tbody tr').count()) !== 9) throw new Error('expected 9 columns');

  step('Model Library: logistic regression (pure TS)');
  await page.getByTestId('nav-library').click();
  await page.getByTestId('model').selectOption('logistic');
  await page.getByTestId('train').click();
  await waitTask();
  await page.getByTestId('result').waitFor();
  console.log(`  accuracy ${await metric('accuracy')}`);

  step('Model Library: random forest (Pyodide / scikit-learn engine packs)');
  await page.getByTestId('model').selectOption('random_forest');
  await page.getByTestId('train').click();
  await waitTask();
  console.log(`  accuracy ${await metric('accuracy')}`);
  await page.getByTestId('threshold').count(); // multiclass → no threshold panel (binary only)
  await shot(page, 'library');

  step('MLP (TF.js) + cooperative cancel');
  await page.getByTestId('model').selectOption('mlp');
  await page.locator('#param-epochs').fill('2000');
  await page.locator('#param-patience').fill('0');
  await page.getByTestId('train').click();
  const running = page.locator('[data-testid=task][data-status=running]').first();
  await running.waitFor({ timeout: T });
  await page.waitForTimeout(1500);
  await running.getByRole('button').click();
  await page.locator('[data-testid=task][data-status=cancelled]').first().waitFor({ timeout: 15_000 });

  step('hard cancel: non-yielding task → terminate() + respawn');
  const hard = await page.evaluate(async () => {
    const { pool } = window.__aml;
    const h = pool.submit({ kind: 'sleep', input: { steps: 1, stepMs: 60_000, blocking: true } }, { label: 'blocking' });
    await new Promise((r) => setTimeout(r, 300));
    h.cancel();
    const outcome = await h.result.then(() => 'resolved', (e) => e.name);
    const after = await pool.submit({ kind: 'sleep', input: { steps: 2, stepMs: 5 } }, { label: 'after' }).result;
    return { outcome, after };
  });
  if (hard.outcome !== 'CancelledError' || hard.after.completed !== 2) throw new Error('hard cancel failed');

  step('Experiments: same-seed re-run reproduces metrics; batch prediction; explanation');
  await page.getByTestId('nav-experiments').click();
  const rows = page.getByTestId('experiment-row');
  await rows.first().waitFor();
  await rows.filter({ hasText: 'logistic-1' }).first().getByTestId('rerun').click();
  const badge = page.getByTestId('repro-badge').first();
  await badge.waitFor({ timeout: T });
  if (!(await badge.innerText()).startsWith('≡')) throw new Error('re-run did not reproduce identical metrics');
  await rows.filter({ hasText: 'random_forest' }).first().locator('button.link').first().click();
  await page.getByTestId('predict-run').click();
  await page.getByTestId('predict-download').waitFor({ timeout: T });
  await page.getByTestId('explain-run').click();
  await page.getByTestId('explanation').waitFor({ timeout: T });

  step('Export: single-file HTML predictor → open it offline and predict');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: T }), page.getByTestId('export-html').click()]);
  const htmlPath = join(profile, 'predictor.html');
  await dl.saveAs(htmlPath);
  const p2 = await ctx.newPage();
  p2.on('pageerror', (e) => problems.push(`predictor: ${e.message}`));
  await p2.goto(pathToFileURL(htmlPath).href);
  await p2.locator('#f input').first().fill('5');
  await p2.locator('#go').click();
  const predText = await p2.locator('#out').innerText();
  console.log(`  predictor says: ${predText}`);
  if (!/價位區間 = /.test(predText)) throw new Error('HTML predictor produced no prediction');
  await p2.close();
  const [onnx] = await Promise.all([page.waitForEvent('download', { timeout: T }), page.getByTestId('export-onnx').click()]);
  if (!(await onnx.suggestedFilename()).endsWith('-onnx.zip')) throw new Error('ONNX export failed');
  await shot(page, 'experiments');

  step('Auto mode (fast preset, 40 s budget)');
  await page.getByTestId('nav-auto').click();
  await page.locator('.preset').first().click();
  await page.locator('.auto-form input[type=number]').first().fill('40');
  await page.getByTestId('auto-run').click();
  await page.getByTestId('auto-result').waitFor({ timeout: T });
  console.log(`  ${(await page.getByTestId('auto-result').innerText()).split('\n').slice(1, 4).join(' ')}`);
  await shot(page, 'auto');

  step('Network designer: top-k MoE end-to-end');
  await page.getByTestId('nav-dag').click();
  await page.getByTestId('dag-template').selectOption('moeTopK');
  await page.getByTestId('dag-train').click();
  await waitTask();
  await page.getByTestId('dag-result').waitFor();
  await shot(page, 'dag');

  step('Script mode: pandas + matplotlib cell');
  await page.getByTestId('nav-script').click();
  await page.getByTestId('script-run-all').click();
  await page.locator('.cell-out img').first().waitFor({ timeout: T });

  step('Titanic sample: leakage warning for "alive"');
  await page.getByTestId('nav-data').click();
  await page.getByTestId('sample-select').selectOption('titanic');
  await page.getByTestId('data-target').selectOption('survived');
  await page.getByTestId('quality-report').filter({ hasText: 'alive' }).waitFor({ timeout: T });
  if (!/leakage|洩漏/.test(await page.getByTestId('quality-report').innerText())) throw new Error('no leakage warning');

  step('persistence: reload keeps the project in IndexedDB');
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByTestId('nav-experiments').click();
  const nExp = await page.getByTestId('experiment-row').count();
  if (nExp < 6) throw new Error(`expected ≥6 experiments after reload, got ${nExp}`);

  step('project .zip export → import');
  const [zipDl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-zip').click()]);
  const zipPath = join(profile, 'project.zip');
  await zipDl.saveAs(zipPath);
  await page.getByTestId('import-zip').setInputFiles(zipPath);
  await page.waitForTimeout(800);
  if ((await page.getByTestId('experiment-row').count()) !== nExp) throw new Error('imported project lost experiments');

  if (problems.length) throw new Error('Console/page problems:\n' + problems.join('\n'));
  console.log(`\nE2E PASSED (file://, offline, Chromium ${ctx.browser()?.version?.() ?? ''}) in ${Math.round((Date.now() - t0) / 1000)} s`);
} catch (e) {
  console.error('\nE2E FAILED:', e.message);
  if (problems.length) console.error(problems.join('\n'));
  await page.screenshot({ path: join(shots ?? profile, 'failure.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  await ctx.close();
  if (!process.exitCode) rmSync(profile, { recursive: true, force: true }); else console.error(`artifacts kept in ${profile}`);
}
void only;
