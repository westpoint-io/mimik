import { translate } from '@mimik/core/i18n/translate';
import { type AppLocale, appLocale } from './app-locale';
import { APP_MESSAGES } from './app-messages';

const active: { locale: AppLocale } = { locale: 'en' };

export const mainI18n = {
  setLocale(code: string): void {
    active.locale = appLocale(null, code);
  },
  t(key: string, substitutions: string[] = []): string {
    const text = translate(APP_MESSAGES[active.locale], key, substitutions);
    return text === key ? translate(APP_MESSAGES.en, key, substitutions) : text;
  },
};
