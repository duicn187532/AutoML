import type { EngineName } from '../models/types';
import bridgeSource from './py/aml_bridge.py?raw';

/**
 * Worker-side engine adapters.
 *  prepare(): runs BEFORE the engine pack's bootstrap scripts (importScripts) — shims globals so
 *             bundles never fall back to eval/new Function and accept our classic Blob worker.
 *  init():    turns what the bundle defined into a ready-to-use handle. Plugins never touch globals.
 */
type Scope = typeof globalThis & Record<string, unknown>;

export interface AdapterContext {
  files: Record<string, Uint8Array>;
  meta: Record<string, unknown>;
  /** Files of every engine loaded so far in this worker. */
  vfs: Map<string, Uint8Array>;
  engine<T = unknown>(name: EngineName): T;
}

export interface EngineAdapter {
  prepare?(scope: Scope): void;
  init(scope: Scope, ctx: AdapterContext): Promise<unknown>;
}

/* ---------------- Pyodide ---------------- */

/** Minimal surface of the Pyodide API we use. */
export interface Pyodide {
  loadPackage(names: string[], opts?: Record<string, unknown>): Promise<unknown>;
  runPython(code: string): unknown;
  pyimport(name: string): PyBridge;
  FS: { writeFile(path: string, data: string | Uint8Array): void };
  toPy(v: unknown): unknown;
}

/** Functions exported by aml_bridge.py (called with JS values; Pyodide proxies them). */
export interface PyBridge {
  make(path: string, kwargsJson: string): number;
  fit(id: number, kind: string, X: Float64Array, rows: number, cols: number, y: Float64Array, Xv: Float64Array, vrows: number, yv: Float64Array, progress: (json: string) => void, fitKwargsJson: string): string;
  predict(id: number, X: Float64Array, rows: number, cols: number): PyBytes;
  predict_proba(id: number, X: Float64Array, rows: number, cols: number, nClasses: number): PyBytes;
  feature_importances(id: number): PyBytes | undefined;
  dump(id: number): PyBytes;
  load(bytes: Uint8Array): number;
  free(id: number): void;
  export_portable(id: number): string | undefined;
  unsupervised(method: string, paramsJson: string, X: Float64Array, rows: number, cols: number, seed: number): string;
  forecast(method: string, paramsJson: string, y: Float64Array, n: number, horizon: number, holdout: number): string;
  contributions(id: number, X: Float64Array, rows: number, cols: number): string | undefined;
}
export interface PyBytes {
  toJs(): Uint8Array;
  destroy(): void;
}

export interface PyHandle {
  py: Pyodide;
  bridge: PyBridge;
}

/** Serve Pyodide's own asset fetches (wasm, stdlib, wheels) from engine-pack bytes: no network, works on file://. */
function installVirtualFetch(scope: Scope, vbase: string, vfs: Map<string, Uint8Array>) {
  const orig = scope.fetch as typeof fetch;
  if ((orig as { __aml?: boolean }).__aml) return;
  const patched = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(vbase)) return orig.call(scope, input, init);
    const name = decodeURIComponent(url.slice(vbase.length).split(/[?#]/)[0]);
    const bytes = vfs.get(name);
    if (!bytes) return Promise.resolve(new Response(null, { status: 404, statusText: `not packed: ${name}` }));
    const type = name.endsWith('.wasm') ? 'application/wasm' : name.endsWith('.json') ? 'application/json' : 'application/octet-stream';
    return Promise.resolve(new Response(bytes as BodyInit, { status: 200, headers: { 'Content-Type': type } }));
  };
  (patched as { __aml?: boolean }).__aml = true;
  scope.fetch = patched;
}

/** Wheel packs: install their packages into the (shared, mutable) Pyodide handle. */
function pyPackAdapter(): EngineAdapter {
  return {
    async init(_scope, { meta, engine }) {
      const h = engine<Partial<PyHandle> & { py: Pyodide }>('pyodide');
      await h.py.loadPackage(meta.packages as string[], { messageCallback: () => {}, checkIntegrity: false });
      if (!h.bridge && (meta.packages as string[]).includes('scikit-learn')) {
        h.py.FS.writeFile('/home/pyodide/aml_bridge.py', bridgeSource);
        h.bridge = h.py.pyimport('aml_bridge');
      }
      return h;
    },
  };
}

/** Image backbone: a pretrained TF.js layers model plus the layer used as embedding. */
export interface Backbone {
  model: import('@tensorflow/tfjs').LayersModel;
  /** truncated model: image [b, size, size, 3] in [-1, 1] → embedding [b, d] */
  embed: import('@tensorflow/tfjs').LayersModel;
  size: number;
  label: string;
  featureLayer: string;
}

function backboneAdapter(): EngineAdapter {
  return {
    async init(_scope, { files, meta, engine }) {
      const tf = engine<typeof import('@tensorflow/tfjs')>('tfjs');
      const json = JSON.parse(new TextDecoder().decode(files['model.json'])) as { modelTopology: object; weightsManifest: { weights: import('@tensorflow/tfjs').io.WeightsManifestEntry[] }[] };
      const shards = (meta.shards as string[]).map((p) => files[p]);
      const total = shards.reduce((a, b) => a + b.byteLength, 0);
      const weightData = new Uint8Array(total);
      let off = 0;
      for (const sh of shards) { weightData.set(sh, off); off += sh.byteLength; }
      const model = await tf.loadLayersModel(tf.io.fromMemory(json.modelTopology, json.weightsManifest.flatMap((g) => g.weights), weightData.buffer));
      const featureLayer = String(meta.feature);
      const embed = tf.model({ inputs: model.inputs, outputs: model.getLayer(featureLayer).output as import('@tensorflow/tfjs').SymbolicTensor });
      return { model, embed, size: Number(meta.size), label: String(meta.label), featureLayer } satisfies Backbone;
    },
  };
}

export const ENGINE_ADAPTERS: Partial<Record<EngineName, EngineAdapter>> = {
  tfjs: {
    prepare(scope) {
      // tf.min.js embeds regenerator-runtime, which does `regeneratorRuntime = r` in strict mode and,
      // when that throws, falls back to Function("r", ...) → CSP violation. Declaring the global first
      // makes the plain assignment succeed.
      if (!('regeneratorRuntime' in scope)) scope.regeneratorRuntime = undefined;
    },
    async init(scope) {
      const tf = scope.tf as typeof import('@tensorflow/tfjs') | undefined;
      if (!tf) throw new Error('tfjs engine did not define global "tf"');
      // Prefer GPU backends when present in this worker; fall back to CPU.
      for (const b of ['webgpu', 'webgl', 'cpu']) {
        try {
          if (tf.engine().registryFactory[b] && (await tf.setBackend(b))) break;
        } catch { /* try next */ }
      }
      await tf.ready();
      return tf;
    },
  },

  pyodide: {
    prepare(scope) {
      // Pyodide refuses classic workers (probes importScripts("data:…")). Our worker must be classic
      // (module workers cannot be created under file://), so make only that probe fail.
      const orig = scope.importScripts as ((...u: string[]) => void) & { __aml?: boolean };
      if (orig.__aml) return;
      const wrapped = Object.assign((...urls: string[]) => {
        if (urls.some((u) => u.startsWith('data:'))) throw new Error('probe blocked');
        return orig.apply(scope, urls);
      }, { __aml: true });
      scope.importScripts = wrapped;
    },
    async init(scope, { meta, vfs }) {
      const vbase = String(meta.vbase);
      installVirtualFetch(scope, vbase, vfs);
      const lock = JSON.parse(new TextDecoder().decode(vfs.get('pyodide-lock.json')));
      const loadPyodide = scope.loadPyodide as (o: Record<string, unknown>) => Promise<Pyodide>;
      if (!loadPyodide || !scope._createPyodideModule) throw new Error('pyodide engine did not initialise');
      const py = await loadPyodide({
        indexURL: vbase,
        packageBaseUrl: vbase,
        lockFileContents: lock,
        createPyodideModule: scope._createPyodideModule,
        stdout: () => {},
        stderr: (s: string) => console.warn('[py]', s),
      });
      return { py } satisfies Partial<PyHandle>;
    },
  },
  xlsx: {
    async init(scope) {
      if (!scope.XLSX) throw new Error('xlsx engine did not define global "XLSX"');
      return scope.XLSX;
    },
  },
  'mobilenet-025': backboneAdapter(),
  'mobilenet-050': backboneAdapter(),
  'mobilenet-100': backboneAdapter(),
  'py-sklearn': pyPackAdapter(),
  'py-gbdt': pyPackAdapter(),
  'py-stats': pyPackAdapter(),
  'py-plot': pyPackAdapter(),
};
