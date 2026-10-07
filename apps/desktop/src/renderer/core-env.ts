import { configureCore } from '@mimik/core/env';
import type { Settings, SettingsKey } from '@mimik/core/guides/types';
import { type Messages, translate } from '@mimik/core/i18n/translate';
import de from '@mimik/locales/de.yml';
import en from '@mimik/locales/en.yml';
import es from '@mimik/locales/es.yml';
import fr from '@mimik/locales/fr.yml';
import ptBR from '@mimik/locales/pt-BR.yml';
import ru from '@mimik/locales/ru.yml';
import zhCN from '@mimik/locales/zh-CN.yml';
import { type AppLocale, appLocale } from './lib/app-locale';
import { mainFetch } from './lib/main-fetch';

const MESSAGES: Record<AppLocale, Messages> = {
  en: en as Messages,
  de: de as Messages,
  es: es as Messages,
  fr: fr as Messages,
  'pt-BR': ptBR as Messages,
  'zh-CN': zhCN as Messages,
  ru: ru as Messages,
};

const locale = appLocale(window.localStorage.getItem('appLanguage')?.replace(/^"|"$/g, ''), navigator.language);
window.mimik?.locale(locale);

configureCore({
  client: 'desktop',
  fetch: mainFetch,
  t: (key, substitutions) => {
    const text = translate(MESSAGES[locale], key, substitutions);
    return text === key ? translate(MESSAGES.en, key, substitutions) : text;
  },
  assetUrl: (path) => new URL(path.replace(/^\//, ''), document.baseURI).href,
  storage: {
    get: async <K extends SettingsKey>(keys: readonly K[]) => {
      const out: Record<string, unknown> = {};
      for (const key of keys) {
        const raw = window.localStorage.getItem(key);
        if (raw !== null) out[key] = JSON.parse(raw);
      }
      return out as Partial<Pick<Settings, K>>;
    },
    set: async (items: Partial<Settings>) => {
      for (const [key, value] of Object.entries(items)) window.localStorage.setItem(key, JSON.stringify(value));
    },
  },
});
