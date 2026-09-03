import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function localeKeys(path: string): string[] {
  const keys: string[] = [];
  let section = '';

  for (const line of readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n').split('\n')) {
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

describe('zh-CN locale coverage', () => {
  it('matches the English message keys', () => {
    expect(localeKeys('src/app-locales/zh-CN.yml')).toEqual(localeKeys('src/locales/en.yml'));
  });
});
