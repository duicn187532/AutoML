/// <reference types="vite/client" />
declare const __APP_VERSION__: string;
declare const __ENGINE_VERSIONS__: Record<string, string>;
declare module '*.py?raw' { const src: string; export default src; }
