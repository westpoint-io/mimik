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

  it('follows the system into Japanese, Korean and Traditional Chinese', () => {
    expect(appLocale(null, 'ja-JP')).toBe('ja');
    expect(appLocale(null, 'ko-KR')).toBe('ko');
    expect(appLocale(null, 'zh-TW')).toBe('zh-TW');
    expect(appLocale(null, 'zh-HK')).toBe('zh-TW');
    expect(appLocale(null, 'zh')).toBe('zh-CN');
  });

  it('falls back to English for a language Mimik does not ship', () => {
    expect(appLocale(null, 'sv-SE')).toBe('en');
  });
});
