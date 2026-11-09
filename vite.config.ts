/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { engineSpecs } from './build/engines.ts';
import { enginePack } from './build/vite-plugin-engine-pack.ts';
import { devCsp, fileProtocol } from './build/vite-plugin-file-protocol.ts';

/** Engines are packed as chunked base64 classic scripts and loaded on demand (see src/core/engines). */
const engines = engineSpecs();

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
    // file:// cannot fetch sibling fonts (CORS) and the bundle is one classic script:
    // brand images and fonts are embedded as data: URLs.
    assetsInlineLimit: (file) => (/[\\/]src[\\/]assets[\\/]/.test(file) ? true : undefined),
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
