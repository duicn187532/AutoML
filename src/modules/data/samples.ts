import collateralCls from '../../../samples/collateral-classification.csv?raw';
import collateralReg from '../../../samples/collateral-regression.csv?raw';
import type { I18nText } from '@/i18n';

export type SampleGroup = 'finance' | 'classification' | 'regression' | 'timeseries' | 'text' | 'demo';

export interface Sample {
  id: string;
  fileName: string;
  label: I18nText;
  group: SampleGroup;
  target: string;
  /** Rows × columns, shown in the catalogue. */
  size: string;
  /** Bundled text (tiny samples); otherwise loaded from the on-demand `sample-<file>` engine pack. */
  csv?: string;
  hint?: I18nText;
  /** Citation, licence and link to the original source. */
  source?: { cite: string; licence: string; url: string };
}

const UCI = 'CC BY 4.0';

export const SAMPLE_GROUPS: SampleGroup[] = ['finance', 'classification', 'regression', 'timeseries', 'text', 'demo'];

export const SAMPLES: Sample[] = [
  // ---- finance / credit ----
  {
    id: 'credit-default-taiwan', fileName: 'credit-default-taiwan.csv', group: 'finance', target: 'default_next_month', size: '30,000 × 25',
    label: { 'zh-TW': '台灣信用卡違約（二元）', en: 'Taiwan credit-card default (binary)' },
    hint: { 'zh-TW': '2005 年台灣某銀行信用卡客戶；PAY_* 為還款狀態，BILL_AMT* / PAY_AMT* 為帳單與繳款金額（新台幣）。ID 欄會被自動排除。', en: 'Credit-card clients of a Taiwanese bank (2005); PAY_* repayment status, BILL_AMT* / PAY_AMT* amounts in NT$. ID is excluded automatically.' },
    source: { cite: 'Yeh, I.-C. & Lien, C.-H. (2009). The comparisons of data mining techniques for the predictive accuracy of probability of default of credit card clients. Expert Systems with Applications, 36(2), 2473–2480.', licence: UCI, url: 'https://doi.org/10.24432/C55S3H' },
  },
  {
    id: 'bank-marketing', fileName: 'bank-marketing.csv', group: 'finance', target: 'y', size: '4,521 × 17',
    label: { 'zh-TW': '銀行電話行銷：定存申購（二元）', en: 'Bank telemarketing: term deposit (binary)' },
    hint: { 'zh-TW': '「duration」是通話秒數，打完電話才知道 → 實務上屬於洩漏欄位，做可上線的模型時請取消勾選。', en: '"duration" (call length) is only known after the call → leakage for a deployable model; untick it.' },
    source: { cite: 'Moro, S., Cortez, P. & Rita, P. (2014). A data-driven approach to predict the success of bank telemarketing. Decision Support Systems, 62, 22–31. (UCI 10% sample bank.csv)', licence: UCI, url: 'https://doi.org/10.24432/C5K306' },
  },
  {
    id: 'german-credit', fileName: 'german-credit.csv', group: 'finance', target: 'class', size: '1,000 × 21',
    label: { 'zh-TW': '德國信用評等 Statlog（二元）', en: 'German credit, Statlog (binary)' },
    hint: { 'zh-TW': '原資料建議成本矩陣：把壞客戶判成好客戶的成本是反過來的 5 倍 → 可在「門檻」頁調整決策門檻。', en: 'The original cost matrix makes "bad predicted as good" 5× as costly → tune the decision threshold.' },
    source: { cite: 'Hofmann, H. (1994). Statlog (German Credit Data). UCI Machine Learning Repository. (decoded labels as in OpenML credit-g)', licence: UCI, url: 'https://doi.org/10.24432/C5NC77' },
  },
  // ---- classification ----
  {
    id: 'titanic', fileName: 'titanic.csv', group: 'classification', target: 'survived', size: '891 × 15',
    label: { 'zh-TW': 'Titanic 生還（二元，含洩漏欄位示範）', en: 'Titanic survival (binary, leakage demo)' },
    hint: { 'zh-TW': '「alive」與目標完全相同 → 品質報告會警示 target leakage，訓練前請取消勾選。', en: '"alive" duplicates the target → the quality report flags target leakage; untick it before training.' },
    source: { cite: 'Titanic passenger list (Encyclopedia Titanica / British Board of Trade), as distributed in the seaborn-data repository.', licence: 'public domain', url: 'https://github.com/mwaskom/seaborn-data' },
  },
  {
    id: 'breast-cancer-wisconsin', fileName: 'breast-cancer-wisconsin.csv', group: 'classification', target: 'diagnosis', size: '569 × 31',
    label: { 'zh-TW': '乳癌診斷 Wisconsin（二元）', en: 'Breast cancer Wisconsin (binary)' },
    source: { cite: 'Wolberg, W., Mangasarian, O., Street, N. & Street, W. (1995). Breast Cancer Wisconsin (Diagnostic). UCI Machine Learning Repository.', licence: UCI, url: 'https://doi.org/10.24432/C5DW2B' },
  },
  {
    id: 'iris', fileName: 'iris.csv', group: 'classification', target: 'species', size: '150 × 5',
    label: { 'zh-TW': 'Iris 鳶尾花（多類別）', en: 'Iris (multiclass)' },
    source: { cite: 'Fisher, R. A. (1936). The use of multiple measurements in taxonomic problems. Annals of Eugenics, 7(2), 179–188.', licence: UCI, url: 'https://doi.org/10.24432/C56C76' },
  },
  {
    id: 'penguins', fileName: 'penguins.csv', group: 'classification', target: 'species', size: '344 × 7',
    label: { 'zh-TW': 'Palmer 企鵝（多類別，含缺值與類別欄）', en: 'Palmer penguins (multiclass, missing values)' },
    source: { cite: 'Horst, A. M., Hill, A. P. & Gorman, K. B. (2020). palmerpenguins: Palmer Archipelago (Antarctica) penguin data. R package. Data: Gorman et al. (2014), PLoS ONE 9(3): e90081.', licence: 'CC0', url: 'https://allisonhorst.github.io/palmerpenguins/' },
  },
  {
    id: 'wine', fileName: 'wine.csv', group: 'classification', target: 'cultivar', size: '178 × 14',
    label: { 'zh-TW': '葡萄酒產地品種（多類別）', en: 'Wine cultivars (multiclass)' },
    source: { cite: 'Aeberhard, S. & Forina, M. (1991). Wine. UCI Machine Learning Repository.', licence: UCI, url: 'https://doi.org/10.24432/C5PC7J' },
  },
  {
    id: 'digits-8x8', fileName: 'digits-8x8.csv', group: 'classification', target: 'digit', size: '1,797 × 65',
    label: { 'zh-TW': '手寫數字 8×8 像素（10 類）', en: 'Handwritten digits 8×8 (10 classes)' },
    source: { cite: 'Alpaydin, E. & Kaynak, C. (1998). Optical Recognition of Handwritten Digits. UCI Machine Learning Repository (scikit-learn load_digits subset).', licence: UCI, url: 'https://doi.org/10.24432/C50P49' },
  },
  // ---- regression ----
  {
    id: 'california-housing', fileName: 'california-housing.csv', group: 'regression', target: 'median_house_value', size: '20,640 × 10',
    label: { 'zh-TW': '加州房價 1990 普查（迴歸）', en: 'California housing, 1990 census (regression)' },
    hint: { 'zh-TW': '目標在 500,001 被截頂（censored）；total_bedrooms 有缺值。', en: 'The target is capped at 500,001; total_bedrooms has missing values.' },
    source: { cite: 'Pace, R. K. & Barry, R. (1997). Sparse spatial autoregressions. Statistics & Probability Letters, 33(3), 291–297. (variant with ocean_proximity from Géron, Hands-On Machine Learning)', licence: 'public domain (StatLib)', url: 'https://doi.org/10.1016/S0167-7152(96)00140-X' },
  },
  {
    id: 'house-prices-train', fileName: 'house-prices-train.csv', group: 'regression', target: 'SalePrice', size: '1,460 × 81',
    label: { 'zh-TW': 'Ames 房價（迴歸，81 欄）', en: 'Ames house prices (regression, 81 columns)' },
    source: { cite: 'De Cock, D. (2011). Ames, Iowa: Alternative to the Boston housing data. Journal of Statistics Education, 19(3).', licence: 'free for education (JSE)', url: 'https://doi.org/10.1080/10691898.2011.11889627' },
  },
  {
    id: 'diabetes', fileName: 'diabetes.csv', group: 'regression', target: 'progression', size: '442 × 11',
    label: { 'zh-TW': '糖尿病病程（迴歸）', en: 'Diabetes progression (regression)' },
    source: { cite: 'Efron, B., Hastie, T., Johnstone, I. & Tibshirani, R. (2004). Least angle regression. Annals of Statistics, 32(2), 407–499.', licence: 'BSD (scikit-learn)', url: 'https://doi.org/10.1214/009053604000000067' },
  },
  // ---- time series ----
  {
    id: 'air-passengers', fileName: 'air-passengers.csv', group: 'timeseries', target: 'passengers', size: '144 × 2',
    label: { 'zh-TW': '國際航空旅客（月，1949–1960）', en: 'Airline passengers (monthly, 1949–1960)' },
    hint: { 'zh-TW': '經典的趨勢 + 乘法季節性序列，適合「模型庫 → 時間序列預測」。', en: 'Classic trend + multiplicative seasonality; try Model Library → Forecasting.' },
    source: { cite: 'Box, G. E. P., Jenkins, G. M. & Reinsel, G. C. (1976). Time Series Analysis, Forecasting and Control. Holden-Day. Series G.', licence: 'public domain (R datasets)', url: 'https://stat.ethz.ch/R-manual/R-devel/library/datasets/html/AirPassengers.html' },
  },
  {
    id: 'bike-sharing-daily', fileName: 'bike-sharing-daily.csv', group: 'timeseries', target: 'cnt', size: '731 × 15',
    label: { 'zh-TW': '共享單車每日租借量（迴歸 / 時序）', en: 'Bike sharing, daily rentals (regression / time series)' },
    hint: { 'zh-TW': 'casual + registered = cnt → 兩欄都是洩漏欄位，預測 cnt 時請取消勾選。', en: 'casual + registered = cnt → both leak the target; untick them when predicting cnt.' },
    source: { cite: 'Fanaee-T, H. & Gama, J. (2013). Event labeling combining ensemble detectors and background knowledge. Progress in Artificial Intelligence, 2, 113–127.', licence: UCI, url: 'https://doi.org/10.24432/C5W894' },
  },
  // ---- text ----
  {
    id: 'sms-spam', fileName: 'sms-spam.csv', group: 'text', target: 'label', size: '5,574 × 2',
    label: { 'zh-TW': 'SMS 垃圾簡訊（文字分類）', en: 'SMS spam (text classification)' },
    hint: { 'zh-TW': 'message 欄會自動轉成 TF-IDF 特徵。', en: 'The message column becomes TF-IDF features automatically.' },
    source: { cite: 'Almeida, T. A., Gómez Hidalgo, J. M. & Yamakami, A. (2011). Contributions to the study of SMS spam filtering. ACM DocEng 2011.', licence: UCI, url: 'https://doi.org/10.24432/C5CC84' },
  },
  // ---- bundled demo (synthetic) ----
  {
    id: 'collateral-cls', fileName: '抵押品估值-分類.csv', group: 'demo', target: '價位區間', size: '300', csv: collateralCls,
    label: { 'zh-TW': '抵押品估值（分類：價位區間，合成資料）', en: 'Collateral valuation (classification, synthetic)' },
  },
  {
    id: 'collateral-reg', fileName: '抵押品估值-回歸.csv', group: 'demo', target: '價位', size: '300', csv: collateralReg,
    label: { 'zh-TW': '抵押品估值（迴歸：價格，合成資料）', en: 'Collateral valuation (regression, synthetic)' },
    hint: { 'zh-TW': '「價位正規化」是目標的縮放版本（洩漏）。', en: '"價位正規化" is a rescaled copy of the target (leakage).' },
  },
];

export const samplePack = (s: Sample) => `sample-${s.fileName.replace(/\.csv$/, '')}`;

/** Bytes of a sample (bundled string or from its on-demand engine pack). */
export async function sampleBytes(s: Sample, loadPack: (name: string) => Promise<{ files: Record<string, Uint8Array> }>): Promise<ArrayBuffer> {
  if (s.csv !== undefined) return new TextEncoder().encode(s.csv).buffer as ArrayBuffer;
  const pack = await loadPack(samplePack(s));
  const b = pack.files[s.fileName];
  if (!b) throw new Error(`Sample ${s.fileName} is not in this build`);
  return b.slice().buffer as ArrayBuffer;
}
