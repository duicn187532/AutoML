# AutoML Workbench

瀏覽器內的 ML / DL 工作台（類似 MATLAB 的 Classification / Regression Learner、Experiment Manager、Deep Network Designer、Live Script），
**無後端、可離線**：解壓縮 zip 後雙擊 `index.html`（`file://`）即可使用，資料不會離開你的電腦。同一份建置也可直接放上 GitHub Pages。

第一次開啟會出現 6 步驟的快速導覽（右上角「教學」可再次開啟）。

## 六個模組

| 模組 | 功能 |
|---|---|
| **資料準備** | 匯入 CSV / TSV（UTF-8、Big5）、Excel、JSON、Parquet、圖片資料夾；型別推斷（全量掃描、NA 字串）；資料品質報告與 **target leakage 偵測**；分佈 / 相關矩陣 / 特徵與目標關係；可重播的清理與特徵工程步驟（刪欄、篩選、去重、日期展開、交互項、lag / rolling…）另存衍生資料集；圖片標註工具（鍵盤快捷鍵、webcam 收集） |
| **自動模式** | 快速 / 平衡 / 最佳品質；≤ 2 萬列 k-fold、以上 hold-out；k-fold OOF bagging、TPE + successive halving（時間預算）、Caruana ensemble selection；測試集最後只評估一次；leaderboard（CV ± std、訓練 / 推論時間、大小）、model card、一鍵「在模型庫打開」 |
| **模型庫** | 監督式：線性 / 邏輯、Ridge、ElasticNet、決策樹、隨機森林、ExtraTrees、AdaBoost、HistGBDT、**XGBoost**、**LightGBM**、SVM、kNN、Naive Bayes、LDA / QDA、高斯過程、MLP；「全部訓練」leaderboard；超參數搜尋（grid / random / TPE、平行座標）；hold-out / k-fold / 時間序 / 群組切分；one-hot / ordinal / target / hash 編碼、文字 TF-IDF；混淆矩陣、ROC、門檻滑桿、校準曲線、殘差圖、特徵重要性、permutation importance（95% CI）。非監督：K-means、GMM、階層式、DBSCAN、PCA、t-SNE、Isolation Forest、LOF、Autoencoder。時間序列：ARIMA、ETS、LSTM、GRU、TCN。影像：MobileNet 遷移學習（只練分類頭 / 部分解凍微調）、CNN 從零訓練、自動選 backbone |
| **架構編輯器** | 拖拉節點圖（Input、Dense、Block、Expert、Gate、Merge、Head…），即時形狀與參數量檢查；soft gating、top-k MoE（load balancing）、規則分流；含 XGBoost / RF 等 expert 時自動改用兩階段訓練；門衛視覺化；Wide & Deep、MoE、多任務、ResNet 式範本；JSON 匯入匯出；產生 Keras / PyTorch / TF.js 程式碼 |
| **實驗管理** | 每次訓練自動記錄（設定、seed、資料版本、分數、耗時），排序 / 篩選 / 曲線比較；以相同 seed 一鍵重跑並驗證完全重現；批次預測、單筆預測解釋（TreeSHAP / 特徵替換）；匯出 **單檔 HTML 預測器**、**ONNX**、模型 JSON + JS runtime、TF.js、Python 腳本、model card；任務佇列可暫停 / 取消 |
| **腳本模式** | 離線 Python（Pyodide：numpy、pandas、scikit-learn、XGBoost、LightGBM、statsmodels、matplotlib）；`aml.load()` / `aml.save_dataset()` 與 GUI 共用資料；「複製成程式碼」把 GUI 實驗變成可執行 cell |

專案（資料集、管線、模型、實驗、腳本、網路架構）自動存在瀏覽器 IndexedDB；**正式存檔請用「匯出專案 .zip」**（`file://` 頁面的瀏覽器儲存可能被清除）。

## 支援瀏覽器與限制

- **Chrome / Edge 桌機版**：已實測 `file://`（見 [ADR 0001](docs/decisions/0001-file-protocol-loading.md)）。Firefox / Safari 尚未驗證。
- 第一次使用 Python 模型會冷啟動 Pyodide 約 10 秒；同一時間只保留一個 Python worker。
- 建議資料量上限：GBDT 約 50 萬列 × 20 欄（約 20–30 秒、0.5 GB）；網路參數量超過 500 萬會警示（[ADR 0002](docs/decisions/0002-engines-and-limits.md)）。
- 取消正在執行的 Python 訓練會重啟 worker（瀏覽器沒有可中斷 Python 的機制）。
- 尚未提供：文字 embedding 模型（目前用 TF-IDF）、GAN / GNN / 強化學習 / 音訊、ONNX 匯出 ensemble。見 [ROADMAP](docs/ROADMAP.md)、[ADR 0003](docs/decisions/0003-deferred-items.md)。

## 開發

```bash
npm install
npm run fetch:pyodide     # 一次：Pyodide wheels（sklearn / XGBoost / LightGBM / statsmodels / matplotlib）→ vendor/
npm run fetch:models      # 一次：MobileNet 預訓練權重 → vendor/
npm run dev               # 開發伺服器
npm test                  # 單元測試（指標已與 scikit-learn 比對）
npm run lint && npm run typecheck
npm run build             # dist/：index.html + assets/ + engines/（可直接 zip 交付）
npm run e2e               # 以 file:// + 離線模式跑完整流程（Playwright Chromium）
npm run m0:file-protocol  # 瀏覽器在 file:// 下的能力檢查
npm run m0:benchmark      # GBDT / TF.js / Pyodide 效能（需先 build）
scripts/verify-exports/run.sh   # ONNX 與 JS runtime 對照 sklearn / XGBoost / LightGBM 的預測
```

推送 `v*` tag 會建置、測試、打包離線 zip 發佈 Release，並部署 GitHub Pages（`.github/workflows/release.yml`）。

## 架構重點

- **單一 IIFE bundle + inline Blob worker**：`file://` 無法載入 ES module 或從檔案建立 worker。
- **引擎包**：TF.js、Pyodide 與 wheels、SheetJS、MobileNet、範例資料都打包成分塊 base64 classic script，用到才載入、顯示進度、sha256 驗證；Pyodide 的資源請求在 worker 內由引擎包供應（不連網）。
- **模型 plugin 介面**（`src/core/models/types.ts`）：`fit / predict / predictProba / export / load` + 參數 schema（表單自動產生）。
- **可重現、不洩漏**：所有隨機步驟用有 seed 的 PRNG 子串流；前處理只在訓練資料 fit；測試集只評估一次。
- **安全**：嚴格 CSP（無 `unsafe-eval`、無遠端主機）；lint 禁止 `innerHTML`；使用者字串一律 escape；CSV 輸出防公式注入。

```
src/core/     與 UI 無關：data / ml / models / workers / engines / storage / project / export / dag / auto / security
src/app/      外框、狀態、actions、服務單例
src/modules/  六個模組畫面          src/charts/  uPlot（即時曲線）、ECharts（分析圖）
build/        Vite plugins 與引擎清單    samples/  範例資料    docs/  路線圖與決策紀錄    legacy/  舊版（參考）
```

## 授權

目前沿用 AGPL-3.0（見 `LICENSE`）。是否改授權（例如 MIT / Apache-2.0）需由專案擁有者決定；相依套件授權：TF.js / Pyodide / XGBoost / LightGBM（Apache-2.0）、scikit-learn / statsmodels / pandas / numpy（BSD）、SheetJS CE（Apache-2.0）、ECharts（Apache-2.0）、uPlot（MIT）。
