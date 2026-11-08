export const LOCALES = ['zh-TW', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
/** Inline bilingual text, used by plugin metadata that ships outside the dictionaries. */
export type I18nText = Record<Locale, string>;
