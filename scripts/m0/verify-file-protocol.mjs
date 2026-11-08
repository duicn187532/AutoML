// M0 technical check: what works when the app is opened via file://
// Usage: node scripts/m0/verify-file-protocol.mjs [--browser chromium|firefox|webkit]
// Writes a fixture into a temp dir, opens it via file:// and prints a JSON report.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = await import('/opt/node-tools/node_modules/playwright/index.js').then((m) => m.default ?? m); }

const browserName = process.argv.includes('--browser') ? process.argv[process.argv.indexOf('--browser') + 1] : 'chromium';

// Minimal valid wasm module exporting add(i32,i32)->i32
const WASM_ADD = Buffer.from('0061736d0100000001070160027f7f017f030201000707010361646400000a09010700200020016a0b', 'hex');
const workerSrc = 'self.x = 41;';

const dir = mkdtempSync(join(tmpdir(), 'aml-m0-'));
const userData = mkdtempSync(join(tmpdir(), 'aml-m0-profile-'));
const csp = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob: data:";

// "Engine pack": classic script that registers base64 payloads on a global
writeFileSync(join(dir, 'engine-pack.js'), `(self.__AML_ENGINES__ ||= {})['demo'] = { files: { 'add.wasm': '${WASM_ADD.toString('base64')}', 'lib.js': '${Buffer.from(workerSrc).toString('base64')}' } };`);
writeFileSync(join(dir, 'module.js'), `window.__moduleRan = true;`);
writeFileSync(join(dir, 'worker.js'), `postMessage('file-worker-ok');`);
writeFileSync(join(dir, 'app.js'), `
window.__results = (async () => {
  const r = {};
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  // 1. dynamic classic <script> injection
  r.dynamicScript = await new Promise((res) => {
    const s = document.createElement('script'); s.src = 'engine-pack.js';
    s.onload = () => res(!!self.__AML_ENGINES__?.demo); s.onerror = () => res(false);
    document.head.appendChild(s);
  });
  // 2. ES module script
  r.moduleScript = !!window.__moduleRan;
  // 3. Worker from file:// URL
  r.fileUrlWorker = await new Promise((res) => {
    try { const w = new Worker('worker.js'); w.onmessage = () => res(true); w.onerror = (e) => { e.preventDefault(); res(false); }; setTimeout(() => res(false), 2000); } catch { res(false); }
  });
  // 4. Blob URL worker that receives engine bytes, importScripts(blob:) and instantiates wasm
  const workerCode = \`
    onmessage = async (e) => {
      const out = {};
      try { const u = URL.createObjectURL(new Blob([e.data.js], {type:'text/javascript'})); importScripts(u); out.importScriptsBlob = self.x === 41; } catch (err) { out.importScriptsBlob = String(err); }
      try { const { instance } = await WebAssembly.instantiate(e.data.wasm); out.wasm = instance.exports.add(20, 22) === 42; } catch (err) { out.wasm = String(err); }
      try { const req = indexedDB.open('aml-worker-db', 1); out.idbInWorker = await new Promise((res) => { req.onsuccess = () => res(true); req.onerror = () => res(String(req.error)); }); } catch (err) { out.idbInWorker = String(err); }
      out.offscreenCanvas = typeof OffscreenCanvas !== 'undefined';
      out.webgl2InWorker = (() => { try { return !!new OffscreenCanvas(1,1).getContext('webgl2'); } catch { return false; } })();
      out.webgpuInWorker = !!self.navigator.gpu;
      postMessage(out);
    };\`;
  const blobUrl = URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' }));
  r.blobWorker = await new Promise((res) => {
    try {
      const w = new Worker(blobUrl);
      w.onmessage = (e) => res(e.data);
      w.onerror = (e) => { e.preventDefault(); res('error: ' + e.message); };
      const files = self.__AML_ENGINES__.demo.files;
      w.postMessage({ js: new TextDecoder().decode(b64(files['lib.js'])), wasm: b64(files['add.wasm']) });
      setTimeout(() => res('timeout'), 5000);
    } catch (err) { res(String(err)); }
  });
  // 5. IndexedDB on main thread (persist check done across reloads by the runner)
  r.idb = await new Promise((res) => {
    try {
      const req = indexedDB.open('aml-m0', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onerror = () => res('error: ' + req.error);
      req.onsuccess = () => {
        const db = req.result; const tx = db.transaction('kv', 'readwrite'); const st = tx.objectStore('kv');
        const g = st.get('visits');
        g.onsuccess = () => { const n = (g.result || 0) + 1; st.put(n, 'visits'); tx.oncomplete = () => res({ ok: true, visits: n }); };
      };
    } catch (err) { res(String(err)); }
  });
  r.storagePersist = navigator.storage?.persist ? await navigator.storage.persist().catch((e) => String(e)) : 'n/a';
  r.storageEstimate = navigator.storage?.estimate ? await navigator.storage.estimate().then((e) => ({ quotaMB: Math.round(e.quota / 1e6) })).catch((e) => String(e)) : 'n/a';
  r.origin = self.origin;
  r.crossOriginIsolated = self.crossOriginIsolated;
  r.sharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
  r.fetchFile = await fetch('engine-pack.js').then(() => true).catch(() => false);
  r.webgpu = !!navigator.gpu;
  return r;
})();
`);
writeFileSync(join(dir, 'index.html'), `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<script type="module" src="module.js"></script>
<script src="app.js" defer></script></head><body>m0</body></html>`);

const url = pathToFileURL(join(dir, 'index.html')).href;
const bt = playwright[browserName];
const report = { browser: browserName, runs: [] };
const cspViolations = [];
for (let run = 0; run < 2; run++) {
  const ctx = await bt.launchPersistentContext(userData, { headless: true });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (/Content Security Policy|Refused/i.test(m.text())) cspViolations.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__results !== undefined);
  report.runs.push(await page.evaluate(() => window.__results));
  report.version = ctx.browser()?.version?.() ?? undefined;
  await ctx.close();
}
report.idbPersistsAcrossRestart = report.runs[1]?.idb?.visits === 2;
report.cspConsole = cspViolations;
console.log(JSON.stringify(report, null, 2));
rmSync(dir, { recursive: true, force: true });
rmSync(userData, { recursive: true, force: true });
