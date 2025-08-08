# 🤖 AutoML 小幫手 (Streamlit + FLAML)

這是一個基於 [FLAML](https://github.com/microsoft/FLAML) 與 [Streamlit](https://streamlit.io) 所開發的 AutoML 工具，讓你可以免寫程式碼完成機器學習模型訓練、預測與結果視覺化！

---

## 🧩 專案特色

- 📤 上傳 CSV 進行模型訓練與驗證
- 🔁 使用 FLAML 進行自動模型選擇與超參數調整
- 📈 顯示訓練 Loss 曲線與特徵重要性
- 🧠 支援多種模型（LightGBM、XGBoost、CatBoost、RandomForest 等）
- ⚙️ 自訂模型參數與資料正規化選項
- 💾 模型與特徵欄位下載、上傳、重複使用
- 🔍 預測新資料並下載預測結果
- 🗂️ 多分頁介面（Tab）避免下載按鈕消失問題

---

## 📦 安裝方式

### ✅ 建議使用虛擬環境

```bash
python -m venv .venv
source .venv/bin/activate  # Windows：.venv\Scripts\activate
```

### ✅ 安裝所需套件

```bash
pip install -r requirements.txt
```

### `requirements.txt` 範例

```
streamlit
pandas
numpy
scikit-learn
matplotlib
flaml
joblib
```

---

## 🖥️ 執行方式

```bash
streamlit run app.py
```

> 執行後會自動開啟瀏覽器介面：  
> http://localhost:8501

---

## 🧪 使用流程

### 🟢 Step 1：訓練模型

1. 上傳包含標籤的訓練 CSV 檔案
2. 選擇：
   - 預測任務類型（classification / regression）
   - 預測目標欄位（Y）
   - 模型選擇（auto / lgbm / xgboost / rf...）
   - 是否正規化
   - 訓練資料比例
3. 點選「🚀 開始訓練」
4. 查看訓練成果與評分指標（Accuracy / MSE）
5. 下載訓練好的 `.pkl` 模型與 `.json` 特徵欄位檔案

---

### 📥 Step 2：下載模型與特徵欄位（模型訓練後會自動顯示下載鈕）

---

### 🔍 Step 3：使用模型預測新資料

1. 上傳：
   - `.pkl` 訓練好的模型
   - `.json` 特徵欄位
   - 預測用 CSV 資料
2. 自動進行預測
3. 預覽結果並下載含「預測值」欄位的 CSV 檔案

---

## 🖼️ 畫面預覽（建議補上以下圖片）

- 訓練頁面畫面
- 特徵重要性圖
- Loss 曲線圖
- 預測結果頁面

---

## 📝 範例資料格式

```csv
age,income,education,married,default
25,50000,bachelor,yes,no
40,85000,master,no,yes
...
```

---

## 📁 專案結構

```
automl-helper/
│
├── app.py                # 主程式
├── requirements.txt      # 套件列表
├── README.md             # 專案說明
└── (optional)
    ├── best_model.pkl    # 訓練好的模型
    └── features.json     # 特徵欄位名稱
```

---

## 📜 License

本專案採用 MIT License 授權，歡迎自由使用與修改。

---

## 🙌 製作與貢獻

由 [JoeWang] 開發。  
歡迎透過 PR 或 Issue 貢獻建議與功能改進 🙌
