import { resolveByLocale } from '@mimik/core/capture/ai/locale';

const APP_LOCALES = ['en', 'de', 'es', 'fr', 'pt-BR', 'zh-CN', 'ru', 'ja', 'ko', 'zh-TW'] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

const BY_CODE = Object.fromEntries(APP_LOCALES.map((locale) => [locale, locale])) as Record<AppLocale, AppLocale>;

export function appLocale(chosen: string | null | undefined, system: string): AppLocale {
  const known = APP_LOCALES.find((locale) => locale === chosen);
  return known ?? resolveByLocale(BY_CODE, system) ?? 'en';
}
