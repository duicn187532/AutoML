import type { ColumnProfile } from '../data/table';
import type { TaskKind } from '../ml/preprocess';

/** Bilingual text (kept local so core does not depend on the UI i18n module). */
export interface AdviceText { 'zh-TW': string; en: string }
export interface ModelAdvice { level: 'warn' | 'info'; text: AdviceText }

/**
 * Data / model compatibility hints shown next to the model picker.
 * Thresholds come from the model × dataset compatibility run (docs/model-compatibility.md).
 */
export function modelAdvice(pluginId: string, task: TaskKind, rows: number, features: ColumnProfile[], params: Record<string, unknown> = {}): ModelAdvice[] {
  const out: ModelAdvice[] = [];
  const text = features.filter((c) => c.kind === 'text').length;
  const cat = features.filter((c) => c.kind === 'categorical').length;
  const dt = features.filter((c) => c.kind === 'datetime').length;
  const usable = features.filter((c) => c.kind !== 'id').length || 1;
  const fmt = (n: number) => n.toLocaleString('en-US');

  if (pluginId === 'gaussian_process' && rows > 3000) {
    out.push({ level: 'warn', text: {
      'zh-TW': `高斯過程的計算量與記憶體隨列數三次方成長：${fmt(rows)} 列可能需要數分鐘甚至耗盡記憶體（實測 1,800 列約 90 秒、5,600 列超過 2.5 分鐘）。建議先用「資料準備 → 抽樣」降到 3,000 列以下，或改用 HistGBDT / XGBoost。`,
      en: `Gaussian processes scale with the cube of the row count: ${fmt(rows)} rows may take many minutes or run out of memory (measured: 1,800 rows ≈ 90 s, 5,600 rows > 2.5 min). Sample down to ≤ 3,000 rows first, or use HistGBDT / XGBoost.`,
    } });
  }
  if (pluginId === 'svm' && rows > 10_000) {
    out.push({ level: 'warn', text: {
      'zh-TW': `SVM 的訓練時間約隨列數平方成長，${fmt(rows)} 列會很慢；建議抽樣到 1 萬列以下，或改用線性模型 / GBDT。`,
      en: `SVM training time grows roughly with the square of the row count; ${fmt(rows)} rows will be slow. Sample below 10,000 rows or use a linear model / GBDT.`,
    } });
  }
  if (pluginId === 'knn' && rows > 50_000) {
    out.push({ level: 'info', text: {
      'zh-TW': 'kNN 預測時要比對所有訓練列，大資料的預測與匯出檔會很慢、很大。',
      en: 'kNN compares every prediction with all training rows; prediction and exported files get slow and large on big data.',
    } });
  }
  if (pluginId === 'naive_bayes' && (text > 0 || cat / usable >= 0.4)) {
    out.push({ level: 'warn', text: {
      'zh-TW': '高斯 Naive Bayes 假設特徵是連續常態分布；文字（TF-IDF）與大量類別欄（one-hot 0/1）會嚴重違反假設，實測準確率明顯偏低（SMS 垃圾簡訊 71%、企鵝 75%）。這類資料請改用邏輯迴歸或樹模型。',
      en: 'Gaussian naive Bayes assumes continuous, normally distributed features; text (TF-IDF) and many one-hot categorical columns break this badly (measured: SMS spam 71 %, penguins 75 % accuracy). Use logistic regression or tree models for such data.',
    } });
  }
  if ((pluginId === 'qda' || pluginId === 'naive_bayes') && text === 0 && cat / usable < 0.4 && features.filter((c) => c.kind === 'numeric').length >= 15) {
    out.push({ level: 'info', text: {
      'zh-TW': '數值特徵很多且彼此高度相關（例如每月帳單金額）時，此模型的假設容易被破壞；實測在台灣信用卡違約資料上準確率低於「全部猜多數類」。建議只當基準模型。',
      en: 'With many strongly correlated numeric features (e.g. monthly bill amounts) this model\'s assumptions break; on the Taiwan credit-default data it scored below the majority-class baseline. Use it only as a baseline.',
    } });
  }
  if (pluginId === 'qda' && (text > 0 || cat / usable >= 0.4)) {
    out.push({ level: 'warn', text: {
      'zh-TW': 'QDA 要為每個類別估一個完整共變異矩陣；文字或大量 one-hot 特徵會讓矩陣近乎奇異，結果不穩定（實測 SMS 81%）。可調高「正則化」或改用 LDA / 邏輯迴歸。',
      en: 'QDA estimates a full covariance matrix per class; text or many one-hot features make it nearly singular and unstable (measured: SMS 81 %). Raise the regularisation or use LDA / logistic regression.',
    } });
  }
  if ((pluginId === 'random_forest' || pluginId === 'extra_trees') && rows > 10_000 && !Number(params.maxDepth) && Number(params.minSamplesLeaf ?? 1) < 5) {
    // fully grown trees keep ~one leaf per few training rows: size ≈ trees × rows × ~60 bytes (regression is worst)
    const mb = Math.round((Number(params.nEstimators ?? 300) * rows * (task === 'regression' ? 60 : 20)) / 1e6);
    out.push({ level: 'warn', text: {
      'zh-TW': `樹不限深度時，模型檔大小約與「樹數 × 列數」成正比，這裡估計約 ${fmt(mb)} MB，可能超過瀏覽器可儲存的大小（模型會無法保存）。建議設定「最大深度」12–20 或「葉節點最少樣本」≥ 5，或減少樹的數量。`,
      en: `With unlimited depth the model size grows with trees × rows — roughly ${fmt(mb)} MB here, which may exceed what the browser can store (the model would not be saved). Set max depth 12–20 or min samples per leaf ≥ 5, or use fewer trees.`,
    } });
  }
  const trees = ['decision_tree', 'random_forest', 'extra_trees', 'adaboost', 'hist_gbdt', 'xgboost', 'lightgbm'];
  if (task === 'regression' && dt > 0 && (trees.includes(pluginId) || pluginId === 'knn' || pluginId === 'gaussian_process')) {
    out.push({ level: 'info', text: {
      'zh-TW': '日期欄會被拆成年 / 月 / 日 / 星期。樹模型與 kNN 無法外推到訓練期間之後的趨勢（預測未來時會停在歷史範圍內）；要預測未來請用「時間序列預測」頁，或搭配「時間切分」檢查。',
      en: 'Date columns become year / month / day / weekday. Tree models and kNN cannot extrapolate a trend beyond the training period; to forecast the future use the Forecasting tab, or validate with a time split.',
    } });
  }
  if ((pluginId === 'lda' || pluginId === 'qda' || pluginId === 'naive_bayes') && task === 'regression') {
    out.push({ level: 'warn', text: { 'zh-TW': '此模型只支援分類。', en: 'This model supports classification only.' } });
  }
  return out;
}

/** Size limits for clustering / embedding / anomaly methods (rows of the dataset). */
export function unsupervisedAdvice(method: string, rows: number): ModelAdvice[] {
  const fmt = (n: number) => n.toLocaleString('en-US');
  if (method === 'agglomerative' && rows > 10_000) return [{ level: 'warn', text: {
    'zh-TW': `階層式分群需要 列數² 的距離矩陣，${fmt(rows)} 列約需 ${Math.round((rows * rows * 8) / 1e9)} GB 記憶體，瀏覽器會失敗。請先抽樣到 1 萬列以下，或改用 k-means。`,
    en: `Agglomerative clustering needs a rows² distance matrix: ${fmt(rows)} rows ≈ ${Math.round((rows * rows * 8) / 1e9)} GB, which fails in the browser. Sample below 10,000 rows or use k-means.`,
  } }];
  if (method === 'tsne' && rows > 10_000) return [{ level: 'warn', text: {
    'zh-TW': `t-SNE 在 ${fmt(rows)} 列上會跑好幾分鐘；建議先抽樣到 5,000–10,000 列，或改用 PCA。`,
    en: `t-SNE on ${fmt(rows)} rows takes many minutes; sample to 5,000–10,000 rows first or use PCA.`,
  } }];
  if ((method === 'dbscan' || method === 'lof') && rows > 50_000) return [{ level: 'info', text: {
    'zh-TW': '此方法需要鄰近搜尋，大資料會較慢。',
    en: 'This method relies on neighbour search and gets slow on large data.',
  } }];
  return [];
}
