import { describe, expect, it } from 'vitest';
import { resolveByLocale } from '../locale';

const TABLE = { es: 'spanish', fr: 'french', 'pt-BR': 'portuguese', 'zh-CN': 'chinese' };

describe('resolveByLocale', () => {
  it('matches an exact code', () => {
    expect(resolveByLocale(TABLE, 'fr')).toBe('french');
  });

  it('matches a regional code to its base language', () => {
    expect(resolveByLocale(TABLE, 'fr-CA')).toBe('french');
    expect(resolveByLocale(TABLE, 'pt')).toBe('portuguese');
    expect(resolveByLocale(TABLE, 'zh')).toBe('chinese');
  });

  it('ignores case', () => {
    expect(resolveByLocale(TABLE, 'ZH-CN')).toBe('chinese');
    expect(resolveByLocale(TABLE, 'Fr')).toBe('french');
  });

  it('ignores surrounding whitespace', () => {
    expect(resolveByLocale(TABLE, '  fr  ')).toBe('french');
  });

  it('returns undefined for an unknown language', () => {
    expect(resolveByLocale(TABLE, 'sv')).toBeUndefined();
  });

  it('returns undefined for an empty locale', () => {
    expect(resolveByLocale(TABLE, '   ')).toBeUndefined();
  });

  it('never reaches an inherited object property', () => {
    expect(resolveByLocale(TABLE, 'constructor')).toBeUndefined();
    expect(resolveByLocale(TABLE, 'toString')).toBeUndefined();
    expect(resolveByLocale(TABLE, '__proto__')).toBeUndefined();
  });
});
