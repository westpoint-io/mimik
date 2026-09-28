import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const LOCALES = ['en', 'zh-CN', 'es', 'fr', 'de', 'pt-BR'] as const;

export type Locale = (typeof LOCALES)[number];

function lines(locale: string): string[] {
  return readFileSync(join(process.cwd(), `src/locales/${locale}.yml`), 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n');
}

function unquote(raw: string): string {
  const value = raw.trim();
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1).replace(/\\"/g, '"');
  return value;
}

export function localeKeys(locale: string): string[] {
  const keys: string[] = [];
  let section = '';

  for (const line of lines(locale)) {
    const top = /^([\w-]+):/.exec(line);
    if (top) {
      section = top[1];
      continue;
    }

    const nested = /^ {2}([\w-]+):/.exec(line);
    if (nested && section) keys.push(`${section}.${nested[1]}`);
  }

  return keys.sort();
}

export function localeMessage(locale: string, path: string): string {
  const [wanted, key] = path.split('.');
  let section = '';

  for (const line of lines(locale)) {
    const top = /^([\w-]+):/.exec(line);
    if (top) section = top[1];
    if (section !== wanted) continue;

    const match = new RegExp(`^ {2}${key}: (.*)$`).exec(line);
    if (match) return unquote(match[1]);
  }

  throw new Error(`${path} missing from ${locale}.yml`);
}

export function renderMessage(locale: string, path: string, substitutions: string[] = []): string {
  return localeMessage(locale, path).replace(/\$(?:\$|(\d))/g, (match, index) =>
    index === undefined ? '$' : (substitutions[Number(index) - 1] ?? match),
  );
}
