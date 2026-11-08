import type { EngineName } from '../models/types';

/**
 * Worker-side engine adapters.
 *  prepare(): runs BEFORE the engine pack's bootstrap scripts (importScripts) — shims globals so
 *             bundles never fall back to eval/new Function (forbidden by our CSP).
 *  init():    turns the global the bundle defined into a ready-to-use handle. Plugins never touch globals.
 */
type Scope = typeof globalThis & Record<string, unknown>;

export interface EngineAdapter {
  prepare?(scope: Scope): void;
  init(scope: Scope, files: Record<string, Uint8Array>): Promise<unknown>;
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
};
