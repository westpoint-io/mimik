import { configureCore } from '@mimik/core/env';
import type { Settings, SettingsKey } from '@mimik/core/guides/types';
import { type Messages, translate } from '@mimik/core/i18n/translate';
import en from '@mimik/locales/en.yml';

configureCore({
  client: 'desktop',
  t: (key, substitutions) => translate(en as Messages, key, substitutions),
  assetUrl: (path) => new URL(path, document.baseURI).href,
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
