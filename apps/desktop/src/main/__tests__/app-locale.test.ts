import { describe, expect, it } from 'vitest';
import { appLocale } from '../app-locale';

describe('appLocale', () => {
  it('takes the language picked in settings', () => {
    expect(appLocale('de', 'en-US')).toBe('de');
  });

  it('follows the system when nothing or an unknown language is picked', () => {
    expect(appLocale(null, 'fr-CA')).toBe('fr');
    expect(appLocale('system', 'zh-CN')).toBe('zh-CN');
    expect(appLocale(undefined, 'pt-PT')).toBe('pt-BR');
  });

  it('falls back to English for a language Mimik does not ship', () => {
    expect(appLocale(null, 'ja-JP')).toBe('en');
  });
});
