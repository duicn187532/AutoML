import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EngineSpec } from './vite-plugin-engine-pack.ts';
import { PY_PACK_GROUPS } from './pyodide-packs.mjs';

/** Package directory without relying on `exports` exposing package.json (xlsx does not). */
const pkgDir = (name: string) => join('node_modules', name);
const pkgVersion = (name: string): string => JSON.parse(readFileSync(join(pkgDir(name), 'package.json'), 'utf8')).version;

/** Virtual base URL the worker serves Pyodide files from (never hits the network). */
export const PYODIDE_VBASE = 'https://aml-engine.invalid/pyodide/';

/**
 * pyodide.asm.mjs is an ES module, which cannot run in a classic (file://-compatible) worker.
 * Rewrite its single `export default` and `import.meta.url` so it can be importScripts()-ed.
 */
function classicPyodideAsm(code: string): string {
  const out = code
    .replace(/export default _createPyodideModule;?/, 'self._createPyodideModule=_createPyodideModule;')
    .replace(/import\.meta\.url/g, JSON.stringify(`${PYODIDE_VBASE}pyodide.asm.mjs`));
  if (/\bexport\s+default\b/.test(out) || !out.includes('self._createPyodideModule=')) throw new Error('pyodide.asm.mjs transform failed (Pyodide layout changed?)');
  return out;
}

export function engineSpecs(): EngineSpec[] {
  const tfDir = pkgDir('@tensorflow/tfjs');
  const specs: EngineSpec[] = [
    {
      name: 'tfjs',
      version: pkgVersion('@tensorflow/tfjs'),
      files: [{ path: join(tfDir, 'dist/tf.min.js'), as: 'tf.min.js', kind: 'js' }],
      bootstrap: ['tf.min.js'],
    },
  ];

  specs.push({
    name: 'xlsx',
    version: pkgVersion('xlsx'),
    files: [{ path: join(pkgDir('xlsx'), 'dist/xlsx.full.min.js'), as: 'xlsx.full.min.js', kind: 'js' }],
    bootstrap: ['xlsx.full.min.js'],
  });

  const pyDir = pkgDir('pyodide');
  const pyVersion = pkgVersion('pyodide');
  specs.push({
    name: 'pyodide',
    version: pyVersion,
    files: [
      { path: join(pyDir, 'pyodide.asm.mjs'), as: 'pyodide.asm.mjs', kind: 'js', transform: classicPyodideAsm },
      { path: join(pyDir, 'pyodide.js'), as: 'pyodide.js', kind: 'js' },
      { path: join(pyDir, 'pyodide.asm.wasm'), as: 'pyodide.asm.wasm', kind: 'wasm' },
      { path: join(pyDir, 'python_stdlib.zip'), as: 'python_stdlib.zip', kind: 'data' },
      { path: join(pyDir, 'pyodide-lock.json'), as: 'pyodide-lock.json', kind: 'json' },
    ],
    bootstrap: ['pyodide.asm.mjs', 'pyodide.js'],
    meta: { vbase: PYODIDE_VBASE },
  });

  // Wheel packs (need `node scripts/fetch-pyodide.mjs`); skipped with a warning when not vendored.
  const lock = JSON.parse(readFileSync(join(pyDir, 'pyodide-lock.json'), 'utf8')) as { packages: Record<string, { file_name: string; depends: string[] }> };
  const shipped = new Set<string>();
  for (const g of PY_PACK_GROUPS) {
    const files = new Set<string>();
    const visit = (n: string) => {
      const p = lock.packages[n];
      if (!p || shipped.has(p.file_name) || files.has(p.file_name)) return;
      files.add(p.file_name);
      p.depends.forEach(visit);
    };
    g.roots.forEach(visit);
    const paths = [...files].map((f) => join('vendor/pyodide', f));
    const missing = paths.filter((p) => !existsSync(p));
    if (missing.length) {
      console.warn(`[engines] ${g.engine}: ${missing.length} wheels missing — run \`node scripts/fetch-pyodide.mjs\`. Pack skipped.`);
      continue;
    }
    files.forEach((f) => shipped.add(f));
    specs.push({
      name: g.engine,
      version: pyVersion,
      files: paths.map((p, i) => ({ path: p, as: [...files][i], kind: 'data' as const })),
      bootstrap: [],
      deps: g.deps,
      meta: { packages: g.roots },
    });
  }
  return specs;
}
