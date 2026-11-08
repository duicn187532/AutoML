import type { Plugin } from 'vite';

/**
 * Make the built index.html openable via file:// (double-click) in Chrome/Edge:
 *  - ES module scripts are blocked on file:// (CORS, origin "null") → emit a classic deferred script
 *    (the bundle itself is built as IIFE in vite.config.ts).
 *  - `crossorigin` attributes trigger CORS requests that fail on file:// → strip them.
 *  - modulepreload links are useless without ESM → drop them.
 */
export function fileProtocol(): Plugin {
  return {
    name: 'aml-file-protocol',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html
          .replace(/<link rel="modulepreload"[^>]*>\s*/g, '')
          .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>')
          .replace(/<script type="module" src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>')
          .replace(/\s+crossorigin(?=[\s>])/g, '');
      },
    },
  };
}

/** Dev server only: Vite/React-refresh inject inline scripts, so relax CSP while developing. */
export function devCsp(): Plugin {
  return {
    name: 'aml-dev-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
    },
  };
}
