const APP_LOCALES = ['en', 'de', 'es', 'fr', 'pt-BR', 'zh-CN', 'ru'] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export function appLocale(chosen: string | null | undefined, system: string): AppLocale {
  const known = (code: string | null | undefined) => APP_LOCALES.find((locale) => locale === code);
  const base = system.split('-')[0]?.toLowerCase();
  return (
    known(chosen) ?? known(system) ?? APP_LOCALES.find((locale) => locale.split('-')[0]!.toLowerCase() === base) ?? 'en'
  );
}
