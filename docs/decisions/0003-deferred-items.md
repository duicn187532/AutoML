# ADR 0003 — Substitutions and deferred items

- 狀態：Accepted
- 日期：2026-11-08

| 規劃項目 | 決定 | 原因 |
|---|---|---|
| DuckDB-Wasm 作為資料引擎 | 改用 PapaParse（CSV）、SheetJS 引擎包（Excel）、hyparquet（Parquet），資料在 worker 內轉為欄式表 | 目前的資料量（≤ 50 萬列，見 ADR 0002）不需要 SQL 引擎；DuckDB 的 worker / wasm 載入方式需另做 file:// 整合，延後到需要 SQL 或更大資料時 |
| Transformers.js（預訓練文字 / 影像 / 音訊 embedding） | 文字先用 TF-IDF（訓練集詞彙、CJK 雙字）；影像用 TF.js MobileNet v1 | 開發環境無法下載 Hugging Face 模型權重；MobileNet 權重可自 storage.googleapis.com 取得並打包成引擎包 |
| UMAP | 不提供，改用 PCA / t-SNE | umap-learn 依賴 numba，Pyodide 無法使用 |
| `@wlearn/xgboost` 純 WASM GBDT | 不採用 | Pyodide XGBoost 效能足夠（ADR 0002），且同時提供 sklearn 生態 |
| ONNX 匯出 | 單一模型（線性、MLP、樹模型）支援；ensemble / 自訂網路架構延後 | TreeEnsembleRegressor + 標準 op 已涵蓋主要模型，並以 onnxruntime 驗證 |
| 小型 Transformer、AE/VAE 以外的生成模型（GAN）、GNN、音訊、強化學習 | 延後 | 需新的資料型態（序列 / 圖 / 音訊輸入節點）與互動環境；優先完成表格與影像主流程 |
| WebGPU backend | 延後 | `tf.min.js` 未含 WebGPU；需在實體 GPU 上重測後再打包 |
