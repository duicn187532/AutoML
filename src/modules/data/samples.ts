import collateralCls from '../../../samples/collateral-classification.csv?raw';
import collateralReg from '../../../samples/collateral-regression.csv?raw';
import type { I18nText } from '@/i18n';

/** Small bundled datasets (work offline; also used by tutorials and E2E tests). */
export const SAMPLES: { id: string; fileName: string; label: I18nText; csv: string }[] = [
  { id: 'collateral-cls', fileName: '抵押品估值-分類.csv', label: { 'zh-TW': '抵押品估值（分類：價位區間）', en: 'Collateral valuation (classification)' }, csv: collateralCls },
  { id: 'collateral-reg', fileName: '抵押品估值-回歸.csv', label: { 'zh-TW': '抵押品估值（迴歸：價格）', en: 'Collateral valuation (regression)' }, csv: collateralReg },
];
