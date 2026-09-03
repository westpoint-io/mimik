import { browser, i18n } from '#imports';
import zhCNMessages from '@/app-locales/zh-CN.yml?raw';
import deMessages from '@/locales/de.yml?raw';
import enMessages from '@/locales/en.yml?raw';
import esMessages from '@/locales/es.yml?raw';
import frMessages from '@/locales/fr.yml?raw';
import ptBRMessages from '@/locales/pt-BR.yml?raw';

type TranslationArgs = Array<number | string[] | null | undefined>;

const APP_LOCALES: Record<string, Record<string, string>> = {
  en: parseMessages(enMessages),
  es: parseMessages(esMessages),
  'pt-BR': parseMessages(ptBRMessages),
  fr: parseMessages(frMessages),
  de: parseMessages(deMessages),
  'zh-CN': parseMessages(zhCNMessages),
};

const nativeT = i18n.t.bind(i18n) as typeof i18n.t;
let activeLocale: string | undefined;
const listeners = new Set<() => void>();

function parseScalar(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value
      .slice(1, -1)
      .replace(/\\x([0-9a-fA-F]{2})/g, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
      .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\\\/g, '\\');
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
  return value;
}

function parseMessages(raw: string): Record<string, string> {
  const messages: Record<string, string> = {};
  let section = '';

  for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;

    const top = /^([\w-]+):\s*$/.exec(line);
    if (top) {
      section = top[1];
      continue;
    }

    const nested = /^ {2}([\w-]+):\s*(.*)$/.exec(line);
    if (nested && section) {
      const value = parseScalar(nested[2].trim());
      messages[`${section}.${nested[1]}`] = value;
      messages[`${section}_${nested[1]}`] = value;
    }
  }

  return messages;
}

function formatMessage(message: string, args: TranslationArgs): string {
  let substitutions: string[] | undefined;
  let count: number | undefined;

  for (const arg of args) {
    if (arg == null) continue;
    if (typeof arg === 'number') count = arg;
    else if (Array.isArray(arg)) substitutions = arg.map(String);
    else throw Error('Unknown i18n argument. Must be a number, substitution array, null, or undefined.');
  }

  if (count !== undefined && substitutions === undefined) substitutions = [String(count)];
  let rendered = message;
  substitutions?.forEach((substitution, index) => {
    rendered = rendered.replaceAll(`$${index + 1}`, substitution);
  });

  if (count === undefined) return rendered;
  const plural = rendered.split(' | ');
  switch (plural.length) {
    case 1:
      return plural[0];
    case 2:
      return plural[count === 1 ? 0 : 1];
    case 3:
      return plural[count === 0 || count === 1 ? count : 2];
    default:
      throw Error('Unknown plural formatting');
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

function normalizeDisplayLocale(locale: unknown): string | undefined {
  return typeof locale === 'string' && APP_LOCALES[locale] ? locale : undefined;
}

export function setDisplayLocale(locale: unknown): void {
  const next = normalizeDisplayLocale(locale);
  if (activeLocale === next) return;
  activeLocale = next;
  if (typeof document !== 'undefined') document.documentElement.lang = activeLocale ?? nativeT('meta.locale');
  notify();
}

export function getDisplayLocale(): string | undefined {
  return activeLocale;
}

export async function loadDisplayLocale(): Promise<void> {
  const stored = await browser.storage.local.get(['aiLanguage']);
  setDisplayLocale(stored?.aiLanguage);
}

export function subscribeDisplayLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

i18n.t = ((key: string, ...args: TranslationArgs) => {
  const message = activeLocale ? APP_LOCALES[activeLocale]?.[key] : undefined;
  if (message !== undefined) return formatMessage(message, args);
  return nativeT(key as never, ...(args as never[]));
}) as typeof i18n.t;

void loadDisplayLocale();

browser.storage.local.onChanged.addListener((changes: Record<string, { newValue?: unknown }>) => {
  if ('aiLanguage' in changes) setDisplayLocale(changes.aiLanguage.newValue);
});
