import streamlit as st
import pandas as pd
import numpy as np
import json
import joblib
import io
import matplotlib.pyplot as plt
import matplotlib

from sklearn.metrics import ConfusionMatrixDisplay, roc_curve, auc
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import accuracy_score, mean_squared_error

from flaml import AutoML
from flaml.automl.data import get_output_from_log

# -------- 版面 & 字型 --------
matplotlib.rcParams['font.family'] = 'sans-serif'
st.set_page_config(page_title="AutoML 小幫手", layout="wide")
st.title("🤖 AutoML 小幫手 (FLAML + Streamlit)")

# -------- Session 狀態 --------
for key in ["model", "X_columns", "scaler", "train_done", "log_file", "column_types", "categorical_columns"]:
    if key not in st.session_state:
        st.session_state[key] = None

# 預設 log 檔名（每次訓練會覆寫）
if not st.session_state["log_file"]:
    st.session_state["log_file"] = "flaml_training.log"

# -------- 分頁 --------
tab1, tab2, tab3 = st.tabs(["🧪 模型訓練", "📥 結果下載", "🔍 模型預測"])

# === 🧪 模型訓練 ===
with tab1:
    st.header("🧪 模型訓練區")
    uploaded_file = st.file_uploader("請上傳訓練用 CSV 檔", type=["csv"])

    if uploaded_file:
        df = pd.read_csv(uploaded_file)
        # 清理欄位名稱（去除空格）
        df.columns = df.columns.str.strip()
        st.subheader("📊 資料預覽")
        st.dataframe(df.head())

        task = st.selectbox("🧠 預測任務類型", options=["classification", "regression"])
        target = st.selectbox("🎯 選擇目標欄位（Y）", options=df.columns)

        # ===== 欄位型別設定 =====
        st.subheader("🛠 欄位型別設定")
        column_types = {}
        categorical_columns = []  # 記錄需要做 one-hot 的欄位
        
        for col in df.drop(columns=[target]).columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                default_type = "numeric"
            else:
                default_type = "category"
            col_type = st.selectbox(
                f"{col} 欄位型別", ["numeric", "category"],
                index=0 if default_type == "numeric" else 1,
                key=f"coltype_{col}"
            )
            column_types[col] = col_type
            if col_type == "category":
                categorical_columns.append(col)

        # ===== 模型與超參數 =====
        model_choice = st.selectbox(
            "🧠 模型選擇（Auto = 自動挑最佳模型）",
            ["auto", "lgbm", "xgboost", "catboost", "rf", "extra_tree", "lrl1", "sgd"]
        )

        custom_params = {}
        if model_choice != "auto":
            st.markdown("🛠 自訂模型參數")
            learning_rate = st.number_input("learning_rate", value=0.1, step=0.01)
            n_estimators = st.number_input("n_estimators", value=100, step=10)
            max_depth = st.number_input("max_depth", value=6, step=1)
            custom_params = {
                "learning_rate": learning_rate,
                "n_estimators": int(n_estimators),
                "max_depth": int(max_depth)
            }

        # ===== 其他設定 =====
        normalize = st.checkbox("⚙️ 對數值欄位進行 MinMax 正規化", value=True)
        train_size = st.slider("📏 訓練資料比例", min_value=0.5, max_value=0.9, value=0.8, step=0.05)
        time_budget = st.number_input("⏱️ 訓練時間上限（秒）", value=60, min_value=10, step=10)

        if st.button("🚀 開始訓練 AutoML 模型"):
            try:
                # 準備資料
                X = df.drop(columns=[target]).copy()
                y = df[target]

                # 套用欄位型別轉換
                for col, col_type in column_types.items():
                    if col_type == "category":
                        X[col] = X[col].astype("category")
                    else:
                        X[col] = pd.to_numeric(X[col], errors="coerce")

                # One-hot encoding（只對分類欄位）
                X_encoded = pd.get_dummies(X, columns=categorical_columns, prefix=categorical_columns)
                
                # 儲存處理後的欄位名稱
                final_columns = X_encoded.columns.tolist()

                # 正規化（僅數值欄位）
                scaler = None
                if normalize:
                    numeric_cols = X_encoded.select_dtypes(include=[np.number]).columns
                    if len(numeric_cols) > 0:
                        scaler = MinMaxScaler()
                        X_encoded[numeric_cols] = scaler.fit_transform(X_encoded[numeric_cols])

                # train/test split
                X_train, X_test, y_train, y_test = train_test_split(
                    X_encoded, y, train_size=train_size, random_state=42, 
                    stratify=y if task == "classification" else None
                )

                # 建立 AutoML
                automl = AutoML()
                log_file = st.session_state["log_file"]

                if model_choice == "auto":
                    automl.fit(
                        X_train=X_train, y_train=y_train,
                        task=task, time_budget=time_budget,
                        log_file_name=log_file
                    )
                else:
                    automl.fit(
                        X_train=X_train, y_train=y_train,
                        task=task, time_budget=time_budget,
                        estimator_list=[model_choice],
                        custom_hp=custom_params,
                        log_file_name=log_file
                    )

                # 預測
                y_pred = automl.predict(X_test)

                st.success("✅ 訓練完成！")
                if task == "classification":
                    acc = accuracy_score(y_test, y_pred)
                    st.metric("🎯 Accuracy", f"{acc:.4f}")
                else:
                    mse = mean_squared_error(y_test, y_pred)
                    st.metric("📉 MSE", f"{mse:.4f}")

                st.write("✅ 最佳模型：", automl.best_estimator)

                # === 訓練歷程 ===
                st.subheader("📉 模型訓練過程（Learning Curve）")
                try:
                    time_hist, best_valid_loss_hist, valid_loss_hist, config_hist, metric_hist = \
                        get_output_from_log(filename=log_file, time_budget=time_budget)

                    score_hist = 1 - np.array(best_valid_loss_hist)

                    fig, ax = plt.subplots()
                    ax.step(time_hist, score_hist, where="post")
                    ax.set_xlabel("Wall Clock Time (s)")
                    ylabel = "Score (1 - best_valid_loss)"
                    if metric_hist and isinstance(metric_hist, dict) and "metric" in metric_hist:
                        metric_name = metric_hist["metric"]
                        if metric_name in {"accuracy", "macro_f1", "micro_f1", "f1", "roc_auc"}:
                            ylabel = f"Validation {metric_name}"
                    ax.set_ylabel(ylabel)
                    ax.set_title("Learning Curve")
                    st.pyplot(fig)
                except Exception as e:
                    st.info(f"學習曲線暫無法產生（{e}）。")

                # === 視覺化：分類任務 ===
                if task == "classification":
                    # 混淆矩陣
                    st.subheader("🧩 混淆矩陣")
                    fig, ax = plt.subplots()
                    ConfusionMatrixDisplay.from_predictions(y_test, y_pred, ax=ax)
                    ax.set_title("Confusion Matrix")
                    st.pyplot(fig)

                    # ROC（二元）
                    classes_ = pd.Series(y_test).unique()
                    if len(classes_) == 2 and hasattr(automl, "predict_proba"):
                        try:
                            y_prob = automl.predict_proba(X_test)[:, 1]
                            fpr, tpr, _ = roc_curve(y_test, y_prob)
                            roc_auc = auc(fpr, tpr)

                            st.subheader("📈 ROC 曲線")
                            fig, ax = plt.subplots()
                            ax.plot(fpr, tpr, label=f"AUC = {roc_auc:.3f}")
                            ax.plot([0, 1], [0, 1], linestyle="--")
                            ax.set_xlabel("False Positive Rate")
                            ax.set_ylabel("True Positive Rate")
                            ax.set_title("ROC Curve (Binary)")
                            ax.legend()
                            st.pyplot(fig)
                        except Exception as e:
                            st.info(f"ROC 無法繪製（{e}）。")

                # === 特徵重要性 ===
                st.subheader("🔎 特徵重要性")
                feature_names = final_columns
                est = getattr(automl.model, "estimator", automl.model)
                importances = None
                try:
                    if hasattr(est, "feature_importances_"):
                        importances = np.array(est.feature_importances_).flatten()
                    elif hasattr(est, "coef_"):
                        importances = np.abs(np.array(est.coef_)).flatten()
                except Exception:
                    pass

                if importances is not None and len(importances) == len(feature_names):
                    sorted_idx = np.argsort(importances)
                    fig, ax = plt.subplots()
                    ax.barh(np.array(feature_names)[sorted_idx], importances[sorted_idx])
                    ax.set_xlabel("Importance")
                    ax.set_title("Feature Importance")
                    st.pyplot(fig)
                else:
                    st.info("此最佳模型無法直接提供特徵重要性。")

                # 儲存訓練結果到 Session（包含完整的處理資訊）
                st.session_state["model"] = automl
                st.session_state["X_columns"] = final_columns
                st.session_state["scaler"] = scaler
                st.session_state["train_done"] = True
                st.session_state["column_types"] = column_types
                st.session_state["categorical_columns"] = categorical_columns

            except Exception as e:
                st.error(f"訓練過程發生錯誤：{e}")
                st.exception(e)

# === 📥 結果下載 ===
with tab2:
    st.header("📥 模型與特徵下載")
    if st.session_state["train_done"]:
        # 下載 AutoML（包含最佳模型）
        model_bytes = io.BytesIO()
        joblib.dump(st.session_state["model"], model_bytes)
        model_bytes.seek(0)
        st.download_button("💾 下載模型（.pkl）", model_bytes, file_name="best_model.pkl")

        # 下載完整的處理資訊（包含欄位名稱、型別、分類欄位等）
        processing_info = {
            "X_columns": st.session_state["X_columns"],
            "column_types": st.session_state["column_types"],
            "categorical_columns": st.session_state["categorical_columns"]
        }
        
        info_bytes = io.BytesIO()
        json_str = json.dumps(processing_info, ensure_ascii=False, indent=2).encode("utf-8")
        info_bytes.write(json_str)
        info_bytes.seek(0)
        st.download_button("📥 下載處理資訊 JSON", info_bytes, file_name="processing_info.json")

        # 下載 scaler（可選）
        if st.session_state["scaler"] is not None:
            scaler_bytes = io.BytesIO()
            joblib.dump(st.session_state["scaler"], scaler_bytes)
            scaler_bytes.seek(0)
            st.download_button("📥 下載數值標準化器（scaler.pkl）", scaler_bytes, file_name="scaler.pkl")
        
        # 顯示資訊預覽
        st.subheader("📋 處理資訊預覽")
        st.json(processing_info)
            
    else:
        st.info("⚠️ 尚未完成訓練")

# === 🔍 模型預測 ===
with tab3:
    st.header("🔍 預測區")

    uploaded_model = st.file_uploader("上傳訓練好模型（.pkl）", type=["pkl"], key="upload_model")
    uploaded_info = st.file_uploader("上傳處理資訊 JSON", type=["json"], key="upload_info")
    uploaded_scaler = st.file_uploader("（可選）上傳 scaler.pkl", type=["pkl"], key="upload_scaler")

    if uploaded_model and uploaded_info:
        try:
            model = joblib.load(uploaded_model)
            processing_info = json.loads(uploaded_info.read().decode("utf-8"))
            
            # 載入處理資訊
            X_columns = processing_info["X_columns"]
            column_types = processing_info["column_types"] 
            categorical_columns = processing_info["categorical_columns"]
            
            st.session_state["model"] = model
            st.session_state["X_columns"] = X_columns
            st.session_state["column_types"] = column_types
            st.session_state["categorical_columns"] = categorical_columns

            if uploaded_scaler:
                st.session_state["scaler"] = joblib.load(uploaded_scaler)

            st.success("✅ 模型與處理資訊已載入")
            st.json(processing_info)
            
        except Exception as e:
            st.error(f"載入模型或處理資訊時發生錯誤：{e}")
            st.exception(e)

    pred_file = st.file_uploader("📤 上傳預測 CSV", type=["csv"], key="predict_csv")

    if pred_file and st.session_state["model"] and st.session_state["X_columns"]:
        try:
            df_pred = pd.read_csv(pred_file)
            # 清理欄位名稱
            df_pred.columns = df_pred.columns.str.strip()
            
            st.subheader("📊 原始預測資料預覽")
            st.dataframe(df_pred.head())

            # 取得處理資訊
            column_types = st.session_state.get("column_types", {})
            categorical_columns = st.session_state.get("categorical_columns", [])
            
            # 套用欄位型別（與訓練時相同的處理）
            for col, typ in column_types.items():
                if col in df_pred.columns:
                    if typ == "category":
                        df_pred[col] = df_pred[col].astype("category")
                    else:
                        df_pred[col] = pd.to_numeric(df_pred[col], errors="coerce")

            # One-hot encoding（與訓練時相同）
            df_pred_encoded = pd.get_dummies(df_pred, columns=[
                col for col in categorical_columns if col in df_pred.columns
            ], prefix=[col for col in categorical_columns if col in df_pred.columns])

            # 🎯 重要：確保欄位與訓練時完全一致
            X_columns = st.session_state["X_columns"]
            
            # 檢查缺少的欄位
            missing_cols = set(X_columns) - set(df_pred_encoded.columns)
            if missing_cols:
                st.warning(f"⚠️ 預測資料缺少以下欄位，將以 0 填補：{missing_cols}")
            
            # 重新索引並填補缺少的欄位
            df_pred_final = df_pred_encoded.reindex(columns=X_columns, fill_value=0)

            # 強制轉為 numeric
            df_pred_final = df_pred_final.apply(pd.to_numeric, errors="coerce").fillna(0)

            # 套用 scaler（如有）
            scaler = st.session_state.get("scaler", None)
            if scaler:
                numeric_cols = df_pred_final.select_dtypes(include=[np.number]).columns
                if len(numeric_cols) > 0:
                    df_pred_final[numeric_cols] = scaler.transform(df_pred_final[numeric_cols])

            st.subheader("🔧 處理後資料預覽")
            st.dataframe(df_pred_final.head())
            st.write(f"處理後形狀：{df_pred_final.shape}")
            st.write(f"預期形狀：({len(df_pred)}, {len(X_columns)})")

            # 預測
            preds = st.session_state["model"].predict(df_pred_final)
            
            # 建立結果 DataFrame
            result_df = df_pred.copy()  # 使用原始資料
            result_df["預測值"] = preds

            st.subheader("📋 預測結果")
            st.dataframe(result_df)

            # 下載結果
            result_csv = result_df.to_csv(index=False, encoding="utf-8-sig")
            st.download_button("📥 下載預測結果 CSV", result_csv, file_name="predictions.csv")

            # Debug 資訊
            with st.expander("🔍 Debug 資訊"):
                st.write("**訓練時欄位：**")
                st.code(str(X_columns))
                st.write("**預測資料欄位：**") 
                st.code(str(df_pred_final.columns.tolist()))
                st.write("**預測資料 dtypes：**")
                st.code(str(df_pred_final.dtypes))

        except Exception as e:
            st.error(f"預測過程發生錯誤：{e}")
            st.exception(e)