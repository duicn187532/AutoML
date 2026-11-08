# Roadmap / 進度

完整任務清單見重構規劃（M0–M9）。本檔追蹤已完成項目；`[~]` = 部分完成。

## M0 技術驗證
- [~] `file://` 動態 `<script>` 載入 base64 包裝的 WASM 與 JS — Chromium ✓（`scripts/m0/verify-file-protocol.mjs`），Firefox / Edge 待測
- [~] `file://` Blob URL Worker、IndexedDB 可用與持久保存 — Chromium ✓
- [ ] Pyodide 在 Worker 內的啟動時間與記憶體
- [ ] GBDT benchmark：Pyodide XGBoost / LightGBM vs `@wlearn/xgboost`
- [ ] TF.js WebGPU / WebGL / WASM benchmark
- [ ] Transformers.js embedding 速度與大小
- [ ] DuckDB-Wasm 讀 CSV / Excel / Parquet
- [~] 決策紀錄 — `docs/decisions/0001-file-protocol-loading.md`

## M1 基礎架構
- [x] Vite + TypeScript + React，ESLint、Vitest
- [x] Vite plugin：IIFE classic script 輸出；引擎 / 權重打包成分塊 base64 `.js` 引擎包（`build/`）
- [x] 引擎載入器：用到才插入 `<script>`、顯示載入進度、sha256 驗證（`src/core/engines/loader.ts`）
- [x] Worker pool（Comlink）：進度回報、協作式取消、`terminate()` 後重建（`src/core/workers/pool.ts`）
- [x] 模型 plugin 介面：fit / predict / predictProba / export / load / 參數 schema / 預設值（`src/core/models/types.ts`）
- [x] 專案資料模型：資料集、前處理 pipeline、模型、實驗紀錄、腳本（`src/core/project/types.ts`）
- [x] 儲存層：IndexedDB + 專案 `.zip` 匯出 / 匯入
- [x] 有 seed 的 PRNG（xoshiro128** + `fork(label)` 子串流）
- [x] 工作台外框：六模組導覽、共用資料面板、任務佇列面板
- [x] 圖表層：uPlot（即時訓練曲線）+ ECharts tree-shaken（混淆矩陣、ROC 等分析圖）
- [x] 繁中 / 英文 i18n（型別強制兩語系 key 一致）
- [x] 安全：CSP meta、使用者字串輸出 escape、禁止 `innerHTML` / `dangerouslySetInnerHTML` 的 lint 規則

## 提前完成的部分（為了驗證 M1 端到端）
- [~] M2：CSV 匯入（UTF-8 / Big5，Worker 內解析）、全量掃描型別推斷與 NA 字串、欄位摘要
- [~] M2：前處理只在訓練資料 fit、可序列化（修正舊版資料洩漏）；hold-out / 分層 / k-fold 切分
- [~] M3：邏輯回歸、Ridge、MLP（TF.js）；schema 自動產生參數表單；混淆矩陣（原始類別名）、ROC
- [x] M3：修正 AUC 計算（rank 統計、處理 ties；ROC 從 (0,0) 起），分類模型一律輸出機率
- [~] M6：實驗紀錄表（排序、篩選）、多實驗曲線比較、一鍵以相同 seed 重跑並標示是否完全重現
- [~] M8：CSV 輸出正確處理 quote（含公式注入防護）
- [~] M9：單元測試與 scikit-learn 1.9 結果比對；Playwright `file://` 離線 E2E

## 下一步
1. M0 剩餘 benchmark（需要 Pyodide / DuckDB / Transformers.js 引擎包；引擎包機制已就緒）。
2. M2 資料準備：DuckDB-Wasm 匯入 Excel / Parquet、品質報告、leakage 偵測、可重播清理步驟。
3. M3 模型庫：Pyodide sklearn / XGBoost / LightGBM plugin、「全部訓練」leaderboard、可解釋性。
