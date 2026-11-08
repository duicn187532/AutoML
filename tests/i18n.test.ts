import { describe, expect, it } from 'vitest';
import { DICTIONARIES, translate } from '@/i18n';
import { listPlugins } from '@/core/models/registry';

describe('i18n', () => {
  it('every key is translated in every locale and placeholders match', () => {
    const zh = DICTIONARIES['zh-TW'], en = DICTIONARIES.en;
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(zh) as (keyof typeof zh)[]) {
      expect(en[k], k).toBeTruthy();
      expect(vars(en[k]), k).toBe(vars(zh[k]));
    }
  });
  it('interpolates variables', () => {
    expect(translate('en', 'data.rows', { n: 5 })).toBe('5 rows');
    expect(translate('zh-TW', 'data.rows', { n: 5 })).toBe('5 列');
  });
  it('plugin metadata is bilingual', () => {
    for (const p of listPlugins()) {
      expect(p.name['zh-TW'] && p.name.en).toBeTruthy();
      for (const s of p.params) expect(s.label['zh-TW'] && s.label.en, `${p.id}.${s.key}`).toBeTruthy();
    }
  });
});
