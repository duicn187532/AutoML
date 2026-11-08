import { create } from 'zustand';
import { en } from './en';
import { LOCALES, type I18nText, type Locale } from './types';
import { zhTW, type MessageKey } from './zh-TW';

export type { I18nText, Locale, MessageKey };
export { LOCALES };

const DICTS: Record<Locale, Record<MessageKey, string>> = { 'zh-TW': zhTW, en };
const STORAGE_KEY = 'aml.locale';

function initialLocale(): Locale {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale;
  } catch { /* storage unavailable */ }
  const nav = globalThis.navigator?.language ?? 'zh-TW';
  return /^zh/i.test(nav) ? 'zh-TW' : 'en';
}

export const useLocale = create<{ locale: Locale; setLocale: (l: Locale) => void }>((set) => ({
  locale: initialLocale(),
  setLocale: (locale) => {
    try { globalThis.localStorage?.setItem(STORAGE_KEY, locale); } catch { /* ignore */ }
    if (globalThis.document) document.documentElement.lang = locale === 'zh-TW' ? 'zh-Hant' : 'en';
    set({ locale });
  },
}));

/** Translate with {var} interpolation. Values are inserted as text (React escapes them). */
export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = DICTS[locale][key] ?? DICTS['zh-TW'][key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function textOf(text: I18nText, locale: Locale): string {
  return text[locale] ?? text['zh-TW'];
}

export function useT() {
  const locale = useLocale((s) => s.locale);
  const t = (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
  return Object.assign(t, { locale, text: (x: I18nText) => textOf(x, locale) });
}

export const DICTIONARIES = DICTS;
