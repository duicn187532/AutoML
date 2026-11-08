import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildEnginePack } from '../build/vite-plugin-engine-pack';
import { CHUNK_CALLBACK, MANIFEST_CALLBACK, type EngineManifest } from '@/core/engines/protocol';

describe('engine pack builder', () => {
  it('chunks files into classic scripts that reassemble byte-exactly', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ep-'));
    const a = Buffer.from('self.x = 1;'), b = Buffer.alloc(5000, 7);
    writeFileSync(join(dir, 'a.js'), a);
    writeFileSync(join(dir, 'b.wasm'), b);
    const out = buildEnginePack({ name: 'demo', version: '1', bootstrap: ['a.js'], files: [{ path: join(dir, 'a.js'), as: 'a.js', kind: 'js' }, { path: join(dir, 'b.wasm'), as: 'b.wasm', kind: 'wasm' }] }, 1024);
    let manifest: EngineManifest | undefined;
    const chunks: string[] = [];
    const sandbox = { self: { [MANIFEST_CALLBACK]: (m: EngineManifest) => (manifest = m), [CHUNK_CALLBACK]: (_n: string, i: number, s: string) => (chunks[i] = s) } };
    for (const [, src] of out) runInNewContext(src, sandbox);
    expect(manifest!.chunks.length).toBe(Math.ceil((a.length + b.length) / 1024));
    const all = Buffer.concat(chunks.map((c) => Buffer.from(c, 'base64')));
    for (const f of manifest!.files) {
      const bytes = all.subarray(f.offset, f.offset + f.length);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(f.sha256);
    }
    expect(() => buildEnginePack({ name: 'x', version: '1', bootstrap: ['nope.js'], files: [] })).toThrow();
  });
});
