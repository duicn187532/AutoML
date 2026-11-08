# ADR 0001 — Loading strategy under `file://`

- 狀態：Accepted（Chromium 已實測；Firefox / Edge / Safari 待測）
- 日期：2026-11-08
- 對應：M0「驗證 file:// 下…」、M1「Vite plugin / 引擎載入器 / Worker pool」

## 背景

交付物是 zip 資料夾，使用者雙擊 `index.html` 以 `file://` 開啟（同一份也放 GitHub Pages）。
`file://` 頁面的 origin 是 `null`，許多 Web 平台功能因此受限。

## 實測（`npm run m0:file-protocol`，Chromium 153 headless）

| 能力 | 結果 | 影響 |
|---|---|---|
| `<script type="module">` | ✗ 被 CORS 擋 | App 必須打包成 **IIFE classic script** |
| `fetch('local-file')` | ✗ | 引擎 / 權重不能用 fetch 讀，改用 classic `<script>` 載入 base64 |
| `new Worker('worker.js')`（檔案 URL） | ✗ | Worker 必須是 **Blob URL**（Vite `?worker&inline`） |
| 動態插入 classic `<script src>` | ✓ | 引擎包 = 分塊 base64 `.js`，載入器逐塊插入並回報進度 |
| Blob Worker 內 `importScripts(blob:)` | ✓ | 主執行緒把引擎 bytes 傳給 worker，worker 自己建 Blob URL 執行 |
| WASM（CSP `'wasm-unsafe-eval'`） | ✓ | Pyodide / DuckDB / XGBoost-WASM 可行，不需 `'unsafe-eval'` |
| IndexedDB（主執行緒 + worker） | ✓，重啟瀏覽器後仍在 | IndexedDB 作為工作儲存 |
| `navigator.storage.persist()` | ✗（headless 回傳 false） | 不能保證不被清除 → **`.zip` 匯出是正式存檔方式** |
| SharedArrayBuffer / crossOriginIsolated | ✗ | 取消不能用 `Atomics`；改用 **訊息 + checkpoint 協作取消，逾時則 `terminate()`** |
| OffscreenCanvas WebGL2 / WebGPU（worker 內） | ✓ | TF.js 可在 worker 內用 GPU backend |
| CSP meta 的 `'self'` 對 `file:` | ✓ 不誤擋 | 可用嚴格 CSP |

## 決策

1. **App bundle**：Vite + `output.format = 'iife'` + `inlineDynamicImports`；`build/vite-plugin-file-protocol.ts`
   把 `<script type="module" crossorigin>` 改寫成 `<script defer>`，移除 `crossorigin` 與 modulepreload。
2. **Workers**：全部用 inline Blob worker；`WorkerPool`（Comlink）負責佇列、進度、協作式取消，
   `hardCancelMs` 後 `terminate()` 並重建 worker。
3. **引擎包**：`build/vite-plugin-engine-pack.ts` 把引擎檔案串接後切成 2 MiB 一塊，輸出
   `engines/<name>/manifest.js` + `part-NNN.js`（呼叫全域 callback 傳入 base64）。manifest 帶 sha256，載入後驗證。
   引擎用到才載入（模型 plugin 宣告 `engines: ['tfjs']`），在主執行緒快取 bytes，每個 worker 首次需要時複製過去。
4. **儲存**：IndexedDB（`projects` / `blobs` / `meta`）為工作儲存；`.aml.zip`（fflate）為正式存檔。
5. **CSP**：`default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; …`，不允許 `'unsafe-eval'` 與任何遠端主機。

## 後果

- 單一 app bundle 約 1 MB（gzip 360 KB）；大型 runtime 一律走引擎包，不進主 bundle。
- base64 讓引擎檔案大約大 33%；換得 `file://` 相容與載入進度。
- 待補實測（M0 剩餘項目）：Firefox `file://`（IndexedDB 在 `file://` 的行為與 Chromium 不同）、Edge、
  Pyodide 啟動時間與記憶體、GBDT benchmark、TF.js backend benchmark、Transformers.js、DuckDB-Wasm。
