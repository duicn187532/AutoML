import { CHUNK_CALLBACK, MANIFEST_CALLBACK, chunkPath, manifestPath, type EngineManifest } from './protocol';
import { base64ToBytes } from '../util/base64';

export interface LoadedEngine {
  manifest: EngineManifest;
  /** Logical file name → bytes. */
  files: Record<string, Uint8Array>;
}

export type EngineProgress = (loadedBytes: number, totalBytes: number) => void;

interface Pending {
  manifest?: EngineManifest;
  onManifest?: (m: EngineManifest) => void;
  onChunk?: (index: number, b64: string) => void;
}

/**
 * Main-thread loader for engine packs. Uses classic <script> injection, which is the only
 * loading primitive that works under file:// (fetch, ESM and file-URL workers are blocked).
 * Loaded engines are cached and handed to workers as bytes.
 */
export class EngineLoader {
  private cache = new Map<string, Promise<LoadedEngine>>();
  private pending = new Map<string, Pending>();

  constructor(private baseUrl = './', private doc: Document = document) {
    const g = globalThis as unknown as Record<string, unknown>;
    g[MANIFEST_CALLBACK] = (m: EngineManifest) => this.pending.get(m.name)?.onManifest?.(m);
    g[CHUNK_CALLBACK] = (name: string, index: number, b64: string) => this.pending.get(name)?.onChunk?.(index, b64);
  }

  load(name: string, onProgress?: EngineProgress): Promise<LoadedEngine> {
    let p = this.cache.get(name);
    if (!p) {
      p = this.doLoad(name, onProgress);
      this.cache.set(name, p);
      p.catch(() => this.cache.delete(name));
    }
    return p;
  }

  isLoaded(name: string): boolean {
    return this.cache.has(name);
  }

  private inject(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = this.doc.createElement('script');
      s.src = this.baseUrl + src;
      s.async = true;
      s.onload = () => { s.remove(); resolve(); };
      s.onerror = () => { s.remove(); reject(new Error(`Failed to load ${src}. Is the engines/ folder next to index.html?`)); };
      this.doc.head.appendChild(s);
    });
  }

  private async doLoad(name: string, onProgress?: EngineProgress): Promise<LoadedEngine> {
    const slot: Pending = {};
    this.pending.set(name, slot);
    try {
      const manifest = await new Promise<EngineManifest>((resolve, reject) => {
        slot.onManifest = resolve;
        this.inject(manifestPath(name)).then(() => { if (!slot.manifest) setTimeout(() => reject(new Error(`Engine manifest for "${name}" did not register`)), 0); }, reject);
      }).then((m) => (slot.manifest = m));
      if (manifest.formatVersion !== 1) throw new Error(`Unsupported engine pack format ${manifest.formatVersion}`);

      const all = new Uint8Array(manifest.totalBytes);
      const offsets: number[] = [];
      manifest.chunks.reduce((off, c, i) => ((offsets[i] = off), off + c.bytes), 0);
      let loaded = 0;
      onProgress?.(0, manifest.totalBytes);
      const received = new Set<number>();
      slot.onChunk = (index, b64) => {
        const bytes = base64ToBytes(b64);
        all.set(bytes, offsets[index]);
        received.add(index);
        loaded += bytes.length;
        onProgress?.(loaded, manifest.totalBytes);
      };
      // a few chunks in flight at once
      const queue = manifest.chunks.map((_, i) => i);
      const worker = async () => {
        for (let i = queue.shift(); i !== undefined; i = queue.shift()) await this.inject(chunkPath(name, i));
      };
      await Promise.all([worker(), worker(), worker()]);
      if (received.size !== manifest.chunks.length) throw new Error(`Engine "${name}" is incomplete`);

      const files: Record<string, Uint8Array> = {};
      for (const f of manifest.files) {
        const bytes = all.subarray(f.offset, f.offset + f.length);
        await verifySha256(bytes, f.sha256, `${name}/${f.name}`);
        files[f.name] = bytes;
      }
      return { manifest, files };
    } finally {
      this.pending.delete(name);
    }
  }
}

async function verifySha256(bytes: Uint8Array, expected: string, label: string): Promise<void> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return; // not available in some insecure contexts; size check above still applies
  const digest = new Uint8Array(await subtle.digest('SHA-256', bytes as BufferSource));
  const hex = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
  if (hex !== expected) throw new Error(`Integrity check failed for ${label}`);
}
