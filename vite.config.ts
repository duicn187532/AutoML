/// <reference types="vitest/config" />
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { enginePack, type EngineSpec } from './build/vite-plugin-engine-pack.ts';
import { devCsp, fileProtocol } from './build/vite-plugin-file-protocol.ts';

const require = createRequire(import.meta.url);
const pkgDir = (name: string) => dirname(require.resolve(`${name}/package.json`));
const pkgVersion = (name: string): string => require(`${name}/package.json`).version;

/** Engines are packed as chunked base64 classic scripts and loaded on demand (see src/core/engines). */
const engines: EngineSpec[] = [
  {
    name: 'tfjs',
    version: pkgVersion('@tensorflow/tfjs'),
    files: [{ path: join(pkgDir('@tensorflow/tfjs'), 'dist/tf.min.js'), as: 'tf.min.js', kind: 'js' }],
    bootstrap: ['tf.min.js'],
  },
];

export default defineConfig({
  base: './',
  plugins: [react(), enginePack({ engines }), fileProtocol(), devCsp()],
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  worker: { format: 'iife' },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    __ENGINE_VERSIONS__: JSON.stringify(Object.fromEntries(engines.map((e) => [e.name, e.version]))),
  },
  build: {
    target: 'es2022',
    modulePreload: false,
    cssCodeSplit: false,
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        // Single classic IIFE bundle: file:// cannot load ES modules or lazy chunks.
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
