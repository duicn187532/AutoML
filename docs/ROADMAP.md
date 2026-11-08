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
- [x] 匯入圖片資料夾（子資料夾 = 類別，worker 內縮圖存成 JPEG）
- [ ] 匯入文字資料集、圖資料（節點 + 邊）
- [x] 型別推斷：數值 / 類別 / 文字 / 日期 / ID，掃描全部資料、NA 字串；可在介面改型別（記錄為步驟）
- [x] 資料品質報告（警告 / 已自動處理）：缺值、常數欄、類 ID 欄、文字欄、高基數、類別不平衡、重複列、離群值
- [x] Target leakage 偵測：單一特徵 hold-out 預測力 ≥ 0.98 時警示
- [x] 探索檢視：分佈圖、相關矩陣、各特徵與目標的關係（預測力 + |r| / η / Cramér V）
- [x] 清理操作：刪欄、改名、改型別、刪缺值列、常數補值、篩選、去重，全部是可重播的步驟並另存衍生資料集
- [x] 特徵工程：日期展開、數學轉換、交互項、時序 lag / rolling（只用過去）；one-hot / ordinal / target / hash encoding（訓練時）
- [x] 前處理只在訓練資料 fit，可序列化
- [x] 切分策略：train / valid / test、分層、k-fold、時間序、群組（含 group k-fold）
- [x] 圖片標註工具：縮圖格、鍵盤 1–9 指定類別、範圍選取、webcam 收集
- [x] 影像資料擴增：翻轉 / 隨機裁切 / 亮度對比（訓練時）；不平衡採樣：待做

## M3 模型庫（進行中）
- [x] Pyodide sklearn：線性（L1/L2/ElasticNet）、決策樹、隨機森林、ExtraTrees、AdaBoost、HistGBDT、SVM、kNN、Naive Bayes、LDA / QDA、高斯過程
- [x] XGBoost、LightGBM（即時學習曲線、early stopping）
- [x] 「全部訓練」+ leaderboard（CV 分數 ± 標準差、時間、模型大小）
- [x] 測試集只在最後評估一次；k-fold CV 平均 ± 標準差；特徵重要性；迴歸「預測 vs 實際」（原始單位）

- [x] 非監督：K-means、GMM、階層式、DBSCAN（輪廓係數）、PCA、t-SNE、Isolation Forest、LOF；UMAP 因 numba 無法在 Pyodide 使用
- [x] 時間序列：ARIMA、ETS（自動頻率 / 季節）；GBDT + lag 特徵（清理步驟 + 時間序切分）
- [x] 門檻滑桿、校準曲線（Brier）
- [x] CNN：遷移學習只練分類頭、部分解凍微調（MobileNet v1 0.25 / 0.5 / 1.0 引擎包）、從零訓練；自動比較 backbone（準確率 + 延遲）
- [ ] 文字 embedding（Transformers.js：此環境無法連到 Hugging Face 下載模型）→ 先以 TF-IDF 備援
- [ ] RNN / LSTM / TCN、小型 Transformer、AE / VAE、GAN、GNN、音訊、RL
- [ ] TreeSHAP / 單筆預測解釋；推薦（矩陣分解）

## M4 自動模式
- [x] 自動判斷任務類型（分類 / 迴歸）；影像在影像訓練器中自動比較 backbone（準確率 + 延遲）
- [x] 驗證策略：≤ 2 萬列 k-fold、以上 hold-out；測試集最後只評估一次
- [x] Portfolio 預設模型組合、k-fold OOF bagging、Caruana ensemble selection
- [x] TPE + 非同步 successive halving，時間預算；early stopping 還原最佳權重
- [x] 品質預設檔、leaderboard（CV ± std、訓練 / 推論時間、大小）、model card、在模型庫打開
- [~] 時序：自動偵測頻率與季節（ARIMA / ETS / LSTM）；自動產生 lag 特徵於清理步驟手動加入
- [ ] 文字自動 backbone（需 embedding 模型）

## M5 架構編輯器
- [x] 畫布（拖拉、連線、多選、複製貼上、復原 / 重做）；Input / Dense / Dropout / BatchNorm / Activation / Block / Expert / Gate / Merge / Head
- [x] 即時形狀檢查與參數量、錯誤標紅、超過上限警示
- [x] Soft gating、Top-k MoE（load-balancing loss）、規則分流；異質 expert 自動兩階段（OOF → 門衛）並在介面說明
- [x] 門衛視覺化（各 expert 樣本比例 / 平均權重 / 負責樣本特徵）
- [x] 範本：Wide & Deep、MoE、多任務、ResNet 式分支；JSON 匯入匯出；Keras / PyTorch / TF.js 程式碼
- [ ] CNN / LSTM / Transformer Block 與多模態範本（需影像 / 序列輸入節點）；載入預訓練模型為節點

## M7 腳本模式
- [x] cell 式 Pyodide console、matplotlib 圖、aml.load / aml.save_dataset、複製成程式碼、隨專案儲存

## M8 匯出
- [x] 單檔 HTML 預測器（單筆表單 + 批次 CSV）、模型 JSON + JS runtime、TF.js 模型、Python 腳本、Model card、批次預測 CSV
- [ ] ONNX 匯出

## 提前完成的部分（為了驗證 M1 端到端）
- [~] M2：CSV 匯入（UTF-8 / Big5，Worker 內解析）、全量掃描型別推斷與 NA 字串、欄位摘要
- [~] M2：前處理只在訓練資料 fit、可序列化（修正舊版資料洩漏）；hold-out / 分層 / k-fold 切分
- [~] M3：邏輯回歸、Ridge、MLP（TF.js）；schema 自動產生參數表單；混淆矩陣（原始類別名）、ROC
- [x] M3：修正 AUC 計算（rank 統計、處理 ties；ROC 從 (0,0) 起），分類模型一律輸出機率
- [~] M6：實驗紀錄表（排序、篩選）、多實驗曲線比較、一鍵以相同 seed 重跑並標示是否完全重現
- [~] M8：CSV 輸出正確處理 quote（含公式注入防護）
- [~] M9：單元測試與 scikit-learn 1.9 結果比對；Playwright `file://` 離線 E2E

## M6 實驗管理
- [x] 超參數範圍 + grid / random / 貝氏（TPE）搜尋；平行座標影響圖
- [x] 任務佇列：排程、暫停 / 繼續、取消（協作 + 強制）；失敗的實驗可一鍵重跑
- [x] 即時曲線、實驗紀錄表、多實驗曲線比較、同 seed 重跑驗證、隨專案 .zip 匯出

## M9 測試、文件與發佈
- [x] 單元測試 55 個（指標對照 scikit-learn；ONNX / JS runtime 對照 14 種模型）
- [x] Playwright E2E：`file://`、離線，涵蓋六個模組、匯出的 HTML 預測器、專案 .zip
- [x] 效能 benchmark（M0 腳本可重跑）
- [x] GitHub Actions：CI（lint / 型別 / 測試 / build / E2E / zip）；tag → Release + Pages
- [x] README、內建教學、範例資料（Iris、Titanic、House Prices、抵押品）
- [ ] 授權：維持 AGPL-3.0，待擁有者決定是否改授權

## 下一步
1. Firefox / Edge / Safari 與實體 GPU 的 M0 實測。
2. 文字 embedding（可取得模型權重後接 Transformers.js）、影像 / 序列輸入節點進入架構編輯器、多模態範本。
3. GAN / GNN / 音訊 / 強化學習、推薦（矩陣分解）、不平衡採樣、ONNX 匯出 ensemble。
