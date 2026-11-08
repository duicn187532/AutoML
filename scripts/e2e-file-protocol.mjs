// End-to-end check of the BUILT app opened via file:// with the network disabled.
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

const url = pathToFileURL(dist).href + '#aml-debug';
const profile = mkdtempSync(join(tmpdir(), 'aml-e2e-'));
const problems = [];
const step = (name) => console.log(`• ${name}`);
const T = 120_000;
/** Wait until the latest train task finishes; fail fast with its error message. */
async function waitTask(page) {
  await page.waitForFunction(() => {
    const t = document.querySelector('[data-testid=task]');
    return t && !['running', 'queued'].includes(t.getAttribute('data-status'));
  }, null, { timeout: T });
  const t = page.getByTestId('task').first();
  const status = await t.getAttribute('data-status');
  if (status !== 'done') throw new Error(`task ${status}: ${await t.innerText()}`);
}

const ctx = await playwright.chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: shots ? 2 : 1, acceptDownloads: true });
await ctx.setOffline(true);
await ctx.addInitScript(() => {
  document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`));
});
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

try {
  step('open via file:// (offline)');
  await page.goto(url);
  await page.getByTestId('nav-data').waitFor();

  step('load bundled sample → parsed in worker → stored');
  await page.getByTestId('sample-collateral-cls').click();
  await page.getByTestId('dataset-item').first().waitFor();
  const colRows = await page.getByTestId('columns-table').locator('tbody tr').count();
  if (colRows !== 9) throw new Error(`expected 9 columns, got ${colRows}`);

  step('train logistic regression (pure TS model in worker)');
  await page.getByTestId('nav-library').click();
  await page.getByTestId('model').selectOption('logistic');
  await page.getByTestId('train').click();
  await waitTask(page);
  await page.getByTestId('result').waitFor({ timeout: T });
  const acc = await page.getByTestId('metric-accuracy').locator('.metric-value').innerText();
  console.log(`  logistic valid accuracy ${acc}`);
  if (shots) await page.screenshot({ path: join(shots, 'library-logistic.png') });

  step('train MLP → loads tfjs engine pack via <script> chunks → Blob worker importScripts');
  await page.getByTestId('model').selectOption('mlp');
  await page.locator('#param-epochs').fill('30');
  await page.getByTestId('train').click();
  await waitTask(page);
  await page.getByText('mlp-2').first().waitFor({ timeout: T });
  const mlpAcc = await page.getByTestId('metric-accuracy').locator('.metric-value').innerText();
  console.log(`  mlp valid accuracy ${mlpAcc}`);
  if (shots) await page.screenshot({ path: join(shots, 'library-mlp.png') });

  step('cooperative cancel of a long MLP run');
  await page.locator('#param-epochs').fill('2000');
  await page.locator('#param-patience').fill('0');
  await page.getByTestId('train').click();
  const running = page.locator('[data-testid=task][data-status=running]').first();
  await running.waitFor({ timeout: T });
  await page.waitForTimeout(500);
  await running.getByRole('button').click();
  await page.locator('[data-testid=task][data-status=cancelled]').first().waitFor({ timeout: 10_000 });

  step('hard cancel: non-yielding task → terminate() + respawn');
  const hard = await page.evaluate(async () => {
    const { pool } = window.__aml;
    const h = pool.submit({ kind: 'sleep', input: { steps: 1, stepMs: 60_000, blocking: true } }, { label: 'blocking' });
    await new Promise((r) => setTimeout(r, 300));
    const t0 = performance.now();
    h.cancel();
    const outcome = await h.result.then(() => 'resolved', (e) => e.name);
    const ms = Math.round(performance.now() - t0);
    const after = await pool.submit({ kind: 'sleep', input: { steps: 2, stepMs: 5 } }, { label: 'after' }).result;
    return { outcome, ms, after };
  });
  console.log(`  ${JSON.stringify(hard)}`);
  if (hard.outcome !== 'CancelledError' || hard.after.completed !== 2) throw new Error('hard cancel failed');

  step('experiments: re-run with same seed reproduces metrics');
  await page.getByTestId('nav-experiments').click();
  const rows = page.getByTestId('experiment-row');
  await rows.first().waitFor();
  const logisticRow = rows.filter({ hasText: 'logistic-1' }).first();
  await logisticRow.getByTestId('rerun').click();
  const badge = page.getByTestId('repro-badge').first();
  await badge.waitFor({ timeout: T });
  const badgeText = await badge.innerText();
  console.log(`  repro badge: ${badgeText}`);
  if (!badgeText.startsWith('≡')) throw new Error('re-run did not reproduce identical metrics');
  if (shots) await page.screenshot({ path: join(shots, 'experiments.png') });

  step('persistence: reload keeps project in IndexedDB');
  await page.waitForTimeout(600); // debounced autosave
  await page.reload();
  await page.getByTestId('dataset-item').first().waitFor();
  await page.getByTestId('nav-experiments').click();
  const nExp = await page.getByTestId('experiment-row').count();
  if (nExp < 4) throw new Error(`expected ≥4 experiments after reload, got ${nExp}`);

  step('export project .zip → import as new project');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-zip').click()]);
  const zipPath = join(profile, 'project.zip');
  await download.saveAs(zipPath);
  await page.getByTestId('import-zip').setInputFiles(zipPath);
  await page.waitForTimeout(500);
  const nExp2 = await page.getByTestId('experiment-row').count();
  if (nExp2 !== nExp) throw new Error(`imported project has ${nExp2} experiments, expected ${nExp}`);
  await page.getByTestId('nav-data').click();
  await page.getByTestId('dataset-item').first().click();
  await page.getByTestId('columns-table').waitFor();

  if (problems.length) throw new Error('Console/page problems:\n' + problems.join('\n'));
  console.log('\nE2E PASSED (file://, offline, Chromium ' + ctx.browser()?.version?.() + ')');
} catch (e) {
  console.error('\nE2E FAILED:', e.message);
  if (problems.length) console.error(problems.join('\n'));
  await page.screenshot({ path: join(shots ?? profile, 'failure.png') }).catch(() => {});
  process.exitCode = 1;
} finally {
  await ctx.close();
  rmSync(profile, { recursive: true, force: true });
}
