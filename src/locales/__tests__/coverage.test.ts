import { describe, expect, it } from 'vitest';
import { LOCALES, localeKeys } from './read-locale';

describe('locale coverage', () => {
  for (const locale of LOCALES) {
    if (locale === 'en') continue;
    it(`${locale} matches the English message keys`, () => {
      expect(localeKeys(locale)).toEqual(localeKeys('en'));
    });
  }
});
