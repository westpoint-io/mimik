import { describe, expect, it } from 'vitest';
import { LOCALES, localeKeys, localeMessage } from './read-locale';

function placeholders(locale: string, key: string): string[] {
  return [...new Set(localeMessage(locale, key).match(/\$\d/g) ?? [])].sort();
}

describe('locale coverage', () => {
  for (const locale of LOCALES) {
    if (locale === 'en') continue;
    it(`${locale} matches the English message keys`, () => {
      expect(localeKeys(locale)).toEqual(localeKeys('en'));
    });

    it(`${locale} keeps every placeholder the English message has`, () => {
      const mismatched = localeKeys('en').filter(
        (key) => placeholders(locale, key).join() !== placeholders('en', key).join(),
      );
      expect(mismatched).toEqual([]);
    });
  }
});
