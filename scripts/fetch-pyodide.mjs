// Download the Pyodide wheels used by the workbench into vendor/pyodide/ (git-ignored).
// The Pyodide core comes from the `pyodide` npm package; wheels come from the matching CDN release.
// Run once before `npm run build` (CI does this too). Offline users never need this: the built
// zip already contains everything as engine packs.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { PY_PACK_GROUPS } from '../build/pyodide-packs.mjs';

const require = createRequire(import.meta.url);
const version = require('pyodide/package.json').version;
const lock = JSON.parse(readFileSync(require.resolve('pyodide/pyodide-lock.json'), 'utf8'));
const out = join('vendor', 'pyodide');
mkdirSync(out, { recursive: true });
const base = `https://cdn.jsdelivr.net/pyodide/v${version}/full/`;

const wanted = new Set(PY_PACK_GROUPS.flatMap((g) => g.roots));
const files = new Set();
const visit = (name) => {
  const p = lock.packages[name];
  if (!p) throw new Error(`package ${name} not in pyodide-lock.json`);
  if (files.has(p.file_name)) return;
  files.add(p.file_name);
  p.depends.forEach(visit);
};
wanted.forEach(visit);

for (const name of Object.keys(lock.packages)) {
  const p = lock.packages[name];
  if (!files.has(p.file_name)) continue;
  const dest = join(out, p.file_name);
  if (existsSync(dest) && createHash('sha256').update(readFileSync(dest)).digest('hex') === p.sha256) continue;
  process.stdout.write(`↓ ${p.file_name} … `);
  const res = await fetch(base + p.file_name);
  if (!res.ok) throw new Error(`${res.status} ${base + p.file_name}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (createHash('sha256').update(buf).digest('hex') !== p.sha256) throw new Error(`sha256 mismatch for ${p.file_name}`);
  writeFileSync(dest, buf);
  console.log(`${(buf.length / 1e6).toFixed(1)} MB`);
}
console.log(`pyodide ${version}: ${files.size} wheels in ${out}`);
