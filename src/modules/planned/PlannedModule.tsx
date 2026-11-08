import type { ModuleId } from '@/app/stores/ui';
import { useT, type I18nText, type MessageKey } from '@/i18n';

const PLANS: Partial<Record<ModuleId, { milestone: string; features: I18nText[] }>> = {
  auto: {
    milestone: 'M4',
    features: [
      { 'zh-TW': '自動判斷任務類型：分類 / 迴歸 / 時序 / 影像 / 文字', en: 'Automatic task detection: classification / regression / time series / image / text' },
      { 'zh-TW': '驗證策略：2 萬筆以下 k-fold，以上 hold-out；測試集只評估一次', en: 'Validation: k-fold below 20k rows, hold-out above; test set evaluated once' },
      { 'zh-TW': '預設模型組合 + k-fold OOF bagging + Caruana ensemble selection', en: 'Portfolio defaults + k-fold OOF bagging + Caruana ensemble selection' },
      { 'zh-TW': 'Successive halving + TPE 超參數搜尋，含時間預算', en: 'Successive halving + TPE search under a time budget' },
      { 'zh-TW': '品質預設檔：快速 / 平衡 / 最佳品質', en: 'Quality presets: fast / balanced / best' },
      { 'zh-TW': 'Leaderboard 與自動 model card，一鍵在模型庫打開', en: 'Leaderboard, auto model card, open in Model Library' },
    ],
  },
  dag: {
    milestone: 'M5',
    features: [
      { 'zh-TW': '節點圖畫布：Input / Layer / Block / Split / Gate / Expert / Merge / Head', en: 'Node canvas: Input / Layer / Block / Split / Gate / Expert / Merge / Head' },
      { 'zh-TW': '即時形狀檢查與參數量統計', en: 'Live shape checking and parameter counts' },
      { 'zh-TW': 'Soft gating、Top-k MoE、規則分流；異質 expert 兩階段訓練', en: 'Soft gating, top-k MoE, rule routing; two-stage training for heterogeneous experts' },
      { 'zh-TW': '範本：Wide & Deep、MoE、多模態融合、多任務', en: 'Templates: Wide & Deep, MoE, multimodal fusion, multi-task' },
      { 'zh-TW': '匯出 TF.js / Keras / PyTorch 程式碼', en: 'Export TF.js / Keras / PyTorch code' },
    ],
  },
  script: {
    milestone: 'M7',
    features: [
      { 'zh-TW': 'Pyodide cell 式 Python console（離線）', en: 'Offline cell-based Python console (Pyodide)' },
      { 'zh-TW': '讀寫工作台的資料集、模型、實驗結果', en: 'Read/write workbench datasets, models and experiments' },
      { 'zh-TW': '內建 numpy、pandas、scikit-learn、XGBoost、LightGBM、statsmodels、matplotlib', en: 'Bundled numpy, pandas, scikit-learn, XGBoost, LightGBM, statsmodels, matplotlib' },
      { 'zh-TW': 'GUI 操作「複製成程式碼」', en: '"Copy as code" from GUI actions' },
    ],
  },
};

export function PlannedModule({ module }: { module: ModuleId }) {
  const t = useT();
  const plan = PLANS[module];
  return (
    <div className="module">
      <h1>{t(`nav.${module}` as MessageKey)}</h1>
      <div className="card planned">
        <h2>{t('planned.title', { milestone: plan?.milestone ?? '' })}</h2>
        <p className="muted">{t('planned.body')}</p>
        <h3>{t('planned.features')}</h3>
        <ul>{plan?.features.map((f, i) => <li key={i}>{t.text(f)}</li>)}</ul>
      </div>
    </div>
  );
}
