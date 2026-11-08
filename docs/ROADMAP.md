# Roadmap / 進度

完整任務清單見重構規劃（M0–M9）。本檔追蹤已完成項目；`[~]` = 部分完成。

## M0 技術驗證
- [~] `file://` 動態 `<script>` 載入 base64 包裝的 WASM 與 JS — Chromium ✓（`scripts/m0/verify-file-protocol.mjs`），Firefox / Edge 待測
- [~] `file://` Blob URL Worker、IndexedDB 可用與持久保存 — Chromium ✓
- [x] Pyodide 在 Worker 內的啟動時間與記憶體（冷啟動 ≈ 11 s；heap 130–460 MB）
- [~] GBDT benchmark：Pyodide XGBoost / LightGBM / HistGBDT（1 萬 / 10 萬 / 50 萬列）；`@wlearn/xgboost` 延後
- [~] TF.js benchmark：CPU vs WebGL（headless）；WebGPU backend 需另打包（M5）
- [ ] Transformers.js embedding 速度與大小
- [~] DuckDB-Wasm：延後；Excel / Parquet 改由 SheetJS 引擎包 / hyparquet 處理
- [x] 決策紀錄 — ADR 0001（file:// 載入）、ADR 0002（引擎、GBDT、資料量上限）

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

## M2 資料準備
- [x] 匯入 CSV / TSV / Excel / Parquet / JSON / JSONL（Worker 內；Excel 用 SheetJS 引擎包、Parquet 用 hyparquet）
- [ ] 匯入圖片資料夾、文字、時間序列、圖資料（隨 DL 模型一起做）
- [x] 型別推斷：數值 / 類別 / 文字 / 日期 / ID，掃描全部資料、NA 字串；可在介面改型別（記錄為步驟）
- [x] 資料品質報告（警告 / 已自動處理）：缺值、常數欄、類 ID 欄、文字欄、高基數、類別不平衡、重複列、離群值
- [x] Target leakage 偵測：單一特徵 hold-out 預測力 ≥ 0.98 時警示
- [x] 探索檢視：分佈圖、相關矩陣、各特徵與目標的關係（預測力 + |r| / η / Cramér V）
- [x] 清理操作：刪欄、改名、改型別、刪缺值列、常數補值、篩選、去重，全部是可重播的步驟並另存衍生資料集
- [x] 特徵工程：日期展開、數學轉換、交互項、時序 lag / rolling（只用過去）；one-hot / ordinal / target / hash encoding（訓練時）
- [x] 前處理只在訓練資料 fit，可序列化
- [x] 切分策略：train / valid / test、分層、k-fold、時間序、群組（含 group k-fold）
- [ ] 圖片標註工具、資料擴增設定

## M3 模型庫（進行中）
- [x] Pyodide sklearn：線性（L1/L2/ElasticNet）、決策樹、隨機森林、ExtraTrees、AdaBoost、HistGBDT、SVM、kNN、Naive Bayes、LDA / QDA、高斯過程
- [x] XGBoost、LightGBM（即時學習曲線、early stopping）
- [x] 「全部訓練」+ leaderboard（CV 分數 ± 標準差、時間、模型大小）
- [x] 測試集只在最後評估一次；k-fold CV 平均 ± 標準差；特徵重要性；迴歸「預測 vs 實際」（原始單位）

## 提前完成的部分（為了驗證 M1 端到端）
- [~] M2：CSV 匯入（UTF-8 / Big5，Worker 內解析）、全量掃描型別推斷與 NA 字串、欄位摘要
- [~] M2：前處理只在訓練資料 fit、可序列化（修正舊版資料洩漏）；hold-out / 分層 / k-fold 切分
- [~] M3：邏輯回歸、Ridge、MLP（TF.js）；schema 自動產生參數表單；混淆矩陣（原始類別名）、ROC
- [x] M3：修正 AUC 計算（rank 統計、處理 ties；ROC 從 (0,0) 起），分類模型一律輸出機率
- [~] M6：實驗紀錄表（排序、篩選）、多實驗曲線比較、一鍵以相同 seed 重跑並標示是否完全重現
- [~] M8：CSV 輸出正確處理 quote（含公式注入防護）
- [~] M9：單元測試與 scikit-learn 1.9 結果比對；Playwright `file://` 離線 E2E

## 下一步
1. M4 自動模式：任務判斷、portfolio、OOF bagging、Caruana ensemble、時間預算的超參數搜尋。
2. M3 剩餘：非監督（分群 / 降維 / 異常偵測）、時間序列、可解釋性（permutation importance、SHAP）、門檻滑桿 / 校準曲線。
3. M6 實驗管理：超參數範圍 + grid / random / 貝氏搜尋、平行座標圖。
