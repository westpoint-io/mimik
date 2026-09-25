import { configureCore } from '@mimik/core/env';
import type { Settings, SettingsKey } from '@mimik/core/guides/types';
import { type Messages, translate } from '@mimik/core/i18n/translate';
import de from '@mimik/locales/de.yml';
import en from '@mimik/locales/en.yml';
import es from '@mimik/locales/es.yml';
import fr from '@mimik/locales/fr.yml';
import ptBR from '@mimik/locales/pt-BR.yml';
import zhCN from '@mimik/locales/zh-CN.yml';
import { type AppLocale, appLocale } from './lib/app-locale';

async function mainFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, key) => {
    headers[key] = value;
  });
  const reply = (await window.mimik.ai.fetch({
    url,
    method: init?.method ?? 'GET',
    headers,
    body: typeof init?.body === 'string' ? init.body : undefined,
  })) as { status: number; statusText: string; headers: Record<string, string>; body: string };
  return new Response(reply.body, { status: reply.status, statusText: reply.statusText, headers: reply.headers });
}

const MESSAGES: Record<AppLocale, Messages> = {
  en: en as Messages,
  de: de as Messages,
  es: es as Messages,
  fr: fr as Messages,
  'pt-BR': ptBR as Messages,
  'zh-CN': zhCN as Messages,
};

const locale = appLocale(window.localStorage.getItem('appLanguage')?.replace(/^"|"$/g, ''), navigator.language);

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
