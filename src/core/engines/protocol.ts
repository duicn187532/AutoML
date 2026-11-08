/**
 * Engine pack wire format — shared by the build plugin (Node) and the runtime loader (browser).
 *
 * An engine pack is a set of *classic* scripts (works under file://, where fetch/ESM are blocked):
 *   engines/<name>/manifest.js   → calls  self[MANIFEST_CALLBACK](manifest)
 *   engines/<name>/part-000.js   → calls  self[CHUNK_CALLBACK](name, index, base64)
 * All files of an engine are concatenated into one byte stream, split into base64 chunks;
 * the manifest records each file's offset/length/sha256 inside that stream.
 */
export const MANIFEST_CALLBACK = '__AML_ENGINE_MANIFEST__';
export const CHUNK_CALLBACK = '__AML_ENGINE_CHUNK__';
export const ENGINE_DIR = 'engines';

export type EngineFileKind = 'js' | 'wasm' | 'data' | 'json';

export interface EngineFileEntry {
  /** Logical name used by the worker, e.g. "tf.min.js". */
  name: string;
  kind: EngineFileKind;
  offset: number;
  length: number;
  sha256: string;
}

export interface EngineManifest {
  formatVersion: 1;
  name: string;
  version: string;
  totalBytes: number;
  chunks: { file: string; bytes: number }[];
  files: EngineFileEntry[];
  /** JS files that the worker must importScripts(), in order. */
  bootstrap: string[];
  /** Engines that must be loaded (in a worker) before this one. */
  deps: string[];
  /** Engine-specific data for the worker adapter (e.g. Python package names). */
  meta?: Record<string, unknown>;
}

export const manifestPath = (name: string) => `${ENGINE_DIR}/${name}/manifest.js`;
export const chunkPath = (name: string, index: number) =>
  `${ENGINE_DIR}/${name}/part-${String(index).padStart(3, '0')}.js`;
