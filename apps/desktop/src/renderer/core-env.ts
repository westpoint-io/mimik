import { configureCore } from '@mimik/core/env';
import type { Settings, SettingsKey } from '@mimik/core/guides/types';
import { translate } from '@mimik/core/i18n/translate';
import { appLocale } from '../main/app-locale';
import { APP_MESSAGES as MESSAGES } from '../main/app-messages';
import { mainFetch } from './lib/main-fetch';

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
