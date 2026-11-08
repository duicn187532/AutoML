# ADR 0002 — Compute engines, GBDT choice and size limits (M0 benchmarks)

- 狀態：Accepted（Chromium headless 實測；實體 GPU / Edge / Firefox 待補）
- 日期：2026-11-08
- 重現：`npm run build && node scripts/m0/benchmark.mjs`（app 以 `file://` 開啟，合成資料於 worker 內產生）

## Pyodide 在 `file://` 的整合方式

Pyodide 314.0.7（Python 3.14、scikit-learn 1.8、XGBoost 2.1.4、LightGBM 4.6、statsmodels 0.14.6）。

- `pyodide.asm.mjs` 是 ES module，classic worker 無法載入 → **打包時改寫**：`export default` → `self._createPyodideModule=`、
  `import.meta.url` → 虛擬 URL，再以 `createPyodideModule` 參數交給 `loadPyodide`。
- Pyodide 會以 `importScripts("data:…")` 偵測 classic worker 並拒絕執行 → adapter 只讓這個偵測失敗。
- Pyodide 自行 `fetch` wasm / stdlib / wheels → worker 內 **patch `fetch`**，`https://aml-engine.invalid/pyodide/*` 一律由引擎包 bytes 回應（不連網）。
- 嚴格 CSP（無 `'unsafe-eval'`）下 sklearn / XGBoost / LightGBM 皆可運作。
- Wheels 依用途分成三個引擎包，後者宣告前者為依賴、不重複打包：
  `pyodide`（12.9 MB）→ `py-sklearn`（numpy / scipy / sklearn，20.6 MB）→ `py-gbdt`（2.2 MB）、`py-stats`（pandas / statsmodels）。
  Wheels 由 `scripts/fetch-pyodide.mjs` 依 `pyodide-lock.json` 下載並驗 sha256（`vendor/`，不進 git）。

## 實測（Chromium 153 headless、單執行緒、20 特徵、二元分類、200 棵樹、無 early stopping）

| 項目 | 結果 |
|---|---|
| 引擎包載入（主執行緒 script + base64 解碼 + sha256） | tfjs 34 ms、pyodide 173 ms、py-sklearn 271 ms、py-gbdt 39 ms |
| Pyodide 冷啟動（worker 內初始化 + 安裝 sklearn + GBDT wheels + 小模型） | **≈ 11 s** |

| 列數 | XGBoost fit / predict | LightGBM fit / predict | HistGBDT fit / predict | WASM heap |
|---|---|---|---|---|
| 1 萬 | 2.0 s / 0.06 s | 1.6 s / 0.6 s | 1.5 s / 0.16 s | 155 MB |
| 10 萬 | 5.5 s / 0.5 s | 6.8 s / 6.1 s | 5.0 s / 1.5 s | 224 MB |
| 50 萬 | 23 s / 2.6 s | 30 s / 32 s | 21 s / 8.2 s | 464 MB |

| TF.js MLP（1 萬列 × 20、5 epochs、batch 256） | fit |
|---|---|
| CPU backend | 5.0 s |
| WebGL backend（headless = SwiftShader 軟體 GPU） | 8.1 s |
| WebGPU | `tf.min.js` 不含 WebGPU backend |

## 決策

1. **GBDT 主引擎：Pyodide XGBoost**（fit 與 HistGBDT 相近，predict 最快）；HistGBDT 為免額外 wheel 的替代；
   LightGBM 保留但不列為自動模式預設（Pyodide 版 predict 在大資料極慢）。
   `@wlearn/xgboost` 純 WASM 版本未測，目前 Pyodide 版本已足夠，**延後**。
2. **資料量上限（建議值）**：GBDT 50 萬列 × 20 特徵約 20–30 s、464 MB heap → 介面在 **> 50 萬列或 列×欄 > 1,000 萬** 時警示；
   wasm32 位址空間 4 GB 為硬上限。
3. **同時間只有一個 Python worker**（`engineWorkerCap: { pyodide: 1 }`），避免多份 0.2–0.5 GB heap；工作會優先派給已載入引擎的 worker。
4. **TF.js 表格模型預設 CPU backend**（MLP 參數可改 WebGL）。WebGPU 需另打包 `@tensorflow/tfjs-backend-webgpu`，於 M5（CNN / DAG）處理，並在實體 GPU 上重測。
5. Python 同步執行期間 worker 無法處理取消訊息（無 SharedArrayBuffer）→ 取消 Python 訓練 = `terminate()`，下次需重新冷啟動 Pyodide。
   GBDT 的每輪學習曲線仍透過 callback 即時回傳。

## 待補
- 實體 GPU 上的 WebGL / WebGPU、Edge / Firefox 數據；Transformers.js、DuckDB-Wasm（Excel / Parquet 目前改用 SheetJS / hyparquet）。
- 參數量上限（M5 DAG 編輯器警示用）。
