import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import type { Plugin } from 'vite';
import {
  CHUNK_CALLBACK,
  ENGINE_DIR,
  MANIFEST_CALLBACK,
  chunkPath,
  manifestPath,
  type EngineFileKind,
  type EngineManifest,
} from '../src/core/engines/protocol.ts';

export interface EngineSourceFile {
  /** Absolute path on disk. */
  path: string;
  /** Logical name exposed to the worker. */
  as: string;
  kind: EngineFileKind;
  /** Optional source transform applied at pack time (text files only). */
  transform?: (code: string) => string;
}

export interface EngineSpec {
  name: string;
  version: string;
  files: EngineSourceFile[];
  /** Names (EngineSourceFile.as) of JS files to importScripts() in the worker, in order. */
  bootstrap: string[];
  deps?: string[];
  meta?: Record<string, unknown>;
}

export interface EnginePackOptions {
  engines: EngineSpec[];
  /** Raw bytes per chunk before base64 (default 2 MiB → ~2.7 MB script). */
  chunkBytes?: number;
}

/** Build the classic-script files for one engine. Exported for tests. */
export function buildEnginePack(spec: EngineSpec, chunkBytes = 2 * 1024 * 1024): Map<string, string> {
  const out = new Map<string, string>();
  const buffers: Buffer[] = [];
  const files: EngineManifest['files'] = [];
  let offset = 0;
  for (const f of spec.files) {
    const raw = readFileSync(f.path);
    const buf = f.transform ? Buffer.from(f.transform(raw.toString('utf8')), 'utf8') : raw;
    files.push({
      name: f.as,
      kind: f.kind,
      offset,
      length: buf.length,
      sha256: createHash('sha256').update(buf).digest('hex'),
    });
    buffers.push(buf);
    offset += buf.length;
  }
  for (const b of spec.bootstrap) {
    if (!files.some((f) => f.name === b)) throw new Error(`[engine-pack] ${spec.name}: bootstrap file "${b}" not in files`);
  }
  const all = Buffer.concat(buffers);
  const chunks: EngineManifest['chunks'] = [];
  for (let i = 0, idx = 0; i < all.length || (all.length === 0 && idx === 0); i += chunkBytes, idx++) {
    const part = all.subarray(i, Math.min(all.length, i + chunkBytes));
    const file = chunkPath(spec.name, idx);
    out.set(file, `self[${JSON.stringify(CHUNK_CALLBACK)}](${JSON.stringify(spec.name)},${idx},"${part.toString('base64')}");\n`);
    chunks.push({ file, bytes: part.length });
    if (all.length === 0) break;
  }
  const manifest: EngineManifest = {
    formatVersion: 1,
    name: spec.name,
    version: spec.version,
    totalBytes: all.length,
    chunks,
    files,
    bootstrap: spec.bootstrap,
    deps: spec.deps ?? [],
    meta: spec.meta,
  };
  out.set(manifestPath(spec.name), `self[${JSON.stringify(MANIFEST_CALLBACK)}](${JSON.stringify(manifest)});\n`);
  return out;
}

/**
 * Vite plugin: packs engine runtimes / weights into chunked base64 classic scripts under
 * `engines/<name>/`, served by the dev server and emitted as assets at build time.
 */
export function enginePack(options: EnginePackOptions): Plugin {
  const cache = new Map<string, { mtimes: string; files: Map<string, string> }>();
  const get = (spec: EngineSpec) => {
    const mtimes = spec.files.map((f) => statSync(f.path).mtimeMs).join(',');
    const hit = cache.get(spec.name);
    if (hit && hit.mtimes === mtimes) return hit.files;
    const files = buildEnginePack(spec, options.chunkBytes);
    cache.set(spec.name, { mtimes, files });
    return files;
  };
  return {
    name: 'aml-engine-pack',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0].replace(/^\/+/, '');
        if (!url.startsWith(`${ENGINE_DIR}/`)) return next();
        const name = url.split('/')[1];
        const spec = options.engines.find((e) => e.name === name);
        const body = spec ? get(spec).get(url) : undefined;
        if (!body) return next();
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        res.end(body);
      });
    },
    generateBundle() {
      for (const spec of options.engines) {
        for (const [fileName, source] of get(spec)) {
          this.emitFile({ type: 'asset', fileName, source });
        }
      }
    },
  };
}
