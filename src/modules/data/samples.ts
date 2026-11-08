import collateralCls from '../../../samples/collateral-classification.csv?raw';
import collateralReg from '../../../samples/collateral-regression.csv?raw';
import type { I18nText } from '@/i18n';

export interface Sample { id: string; fileName: string; label: I18nText; csv?: string; target: string; hint?: I18nText }

/** Bundled (tiny) samples + the on-demand `samples` engine pack (larger, loaded only when chosen). */
export const SAMPLES: Sample[] = [
  { id: 'iris', fileName: 'iris.csv', label: { 'zh-TW': 'Iris 鳶尾花（多類別）', en: 'Iris (multiclass)' }, target: 'species' },
  {
    id: 'titanic', fileName: 'titanic.csv', label: { 'zh-TW': 'Titanic（二元，含洩漏欄位示範）', en: 'Titanic (binary, leakage demo)' }, target: 'survived',
    hint: { 'zh-TW': '「alive」與目標完全相同 → 品質報告會警示 target leakage，訓練前請取消勾選。', en: '"alive" duplicates the target → the quality report flags target leakage; untick it before training.' },
  },
  { id: 'house', fileName: 'house-prices-train.csv', label: { 'zh-TW': 'House Prices（迴歸，81 欄）', en: 'House Prices (regression, 81 columns)' }, target: 'SalePrice' },
  { id: 'collateral-cls', fileName: '抵押品估值-分類.csv', label: { 'zh-TW': '抵押品估值（分類：價位區間）', en: 'Collateral valuation (classification)' }, csv: collateralCls, target: '價位區間' },
  {
    id: 'collateral-reg', fileName: '抵押品估值-回歸.csv', label: { 'zh-TW': '抵押品估值（迴歸：價格）', en: 'Collateral valuation (regression)' }, csv: collateralReg, target: '價位',
    hint: { 'zh-TW': '「價位正規化」是目標的縮放版本（洩漏）。', en: '"價位正規化" is a rescaled copy of the target (leakage).' },
  },
];

/** Bytes of a sample (bundled string or from the on-demand engine pack). */
export async function sampleBytes(s: Sample, loadPack: () => Promise<{ files: Record<string, Uint8Array> }>): Promise<ArrayBuffer> {
  if (s.csv !== undefined) return new TextEncoder().encode(s.csv).buffer as ArrayBuffer;
  const pack = await loadPack();
  const b = pack.files[s.fileName];
  if (!b) throw new Error(`Sample ${s.fileName} is not in this build`);
  return b.slice().buffer as ArrayBuffer;
}
