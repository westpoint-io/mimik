import { configureCore } from '@mimik/core/env';
import type { Settings, SettingsKey } from '@mimik/core/guides/types';
import { type Messages, translate } from '@mimik/core/i18n/translate';
import en from '@mimik/locales/en.yml';

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

configureCore({
  client: 'desktop',
  fetch: mainFetch,
  t: (key, substitutions) => translate(en as Messages, key, substitutions),
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
