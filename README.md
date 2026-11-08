# AutoML Workbench

瀏覽器內的 ML / DL 工作台（類似 MATLAB 的 Learner / Experiment Manager / Deep Network Designer），
**無後端、可離線**：解壓縮後雙擊 `index.html`（`file://`）即可使用，資料不會離開你的電腦。
同一份建置也可以直接放在 GitHub Pages。

> 🚧 重構進行中。已完成 M0 驗證 / benchmark、M1 基礎架構、M2 資料準備（大部分）、M3 / M4 的表格模型與 AutoML，進度見 [`docs/ROADMAP.md`](docs/ROADMAP.md)。
> 舊版程式碼保留在 [`legacy/`](legacy/) 僅作規格參考。

## 模組

| 模組 | 狀態 |
|---|---|
| 資料準備 | CSV / TSV / Excel / JSON / Parquet 匯入；型別推斷；品質報告與 target leakage 偵測；分佈 / 相關 / 目標關係；可重播的清理與特徵工程步驟 |
| 自動模式 | 快速 / 平衡 / 最佳品質；k-fold OOF bagging、TPE + successive halving、Caruana ensemble；leaderboard、model card |
| 模型庫 | 邏輯回歸、Ridge、MLP（TF.js）；scikit-learn 全系列、XGBoost、LightGBM（Pyodide）；hold-out / k-fold / 時間序 / 群組切分與測試集；「全部訓練」leaderboard |
| 架構編輯器 | 規劃中（M5） |
| 實驗管理 | 實驗紀錄（排序 / 篩選）、曲線比較、以相同 seed 一鍵重跑並驗證重現 |
| 腳本模式 | 規劃中（M7；Pyodide 引擎已就緒） |

專案（資料集、模型、實驗）自動存在瀏覽器 IndexedDB；**正式存檔請用「匯出專案 .zip」**
（`file://` 頁面的瀏覽器儲存可能被清除）。

## 支援瀏覽器

Chrome / Edge 桌機版（主要支援，已實測 `file://`）。Firefox / Safari 尚未驗證。

## 開發

```bash
npm install
node scripts/fetch-pyodide.mjs   # 一次：下載 Pyodide wheels（sklearn / XGBoost / LightGBM…）到 vendor/
npm run dev          # 開發伺服器
npm test             # 單元測試（Vitest；指標已與 scikit-learn 比對）
npm run lint && npm run typecheck
npm run build        # 輸出 dist/：index.html + assets/ + engines/
npm run e2e          # 以 file:// + 離線模式跑完整流程（Playwright Chromium）
npm run m0:file-protocol   # M0：瀏覽器在 file:// 下的能力檢查
node scripts/m0/benchmark.mjs   # M0：GBDT / TF.js / Pyodide 效能（需先 build）
```

## 架構重點

- **單一 IIFE bundle**：`file://` 無法載入 ES module，見 [ADR 0001](docs/decisions/0001-file-protocol-loading.md)。
- **全部計算在 Web Worker**（inline Blob worker + Comlink pool）：進度回報、協作式取消，逾時 `terminate()` 重建。
- **引擎包**：大型 runtime（TF.js、Pyodide + wheels、SheetJS）打包成分塊 base64 classic script，
  用到才載入、顯示進度、sha256 驗證。
- **模型 plugin 介面**（`src/core/models/types.ts`）：`fit / predict / predictProba / export / load` + 參數 schema。
- **可重現**：所有隨機步驟使用有 seed 的 PRNG（`fork(label)` 子串流）；前處理只在訓練資料 fit 且可序列化。
- **安全**：嚴格 CSP（無 `unsafe-eval`、無遠端主機）；lint 禁止 `innerHTML`；使用者字串一律 escape。

```
src/
  app/        外框、狀態（zustand）、服務單例
  modules/    六個模組畫面
  core/       與 UI 無關的核心：data / ml / models / workers / engines / storage / project / security
  charts/     uPlot（即時曲線）、ECharts（分析圖）
  i18n/       繁中 / 英文
build/        Vite plugins（file:// 輸出、引擎包）
samples/      範例資料集
docs/         路線圖與決策紀錄
legacy/       舊版（參考用）
```

## 授權

AGPL-3.0（見 `LICENSE`）。
