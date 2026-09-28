import { describe, expect, it } from 'vitest';
import { AI_LANGUAGES, GUIDE_META_PROMPT, getLanguageSuffix } from '../prompts';

describe('GUIDE_META_PROMPT', () => {
  it('has a steps placeholder', () => {
    expect(GUIDE_META_PROMPT).toContain('{{steps}}');
  });

  it('keeps the 60-character title constraint', () => {
    expect(GUIDE_META_PROMPT).toContain('60 characters');
  });

  it('asks for a description of one or two sentences', () => {
    expect(GUIDE_META_PROMPT.toLowerCase()).toContain('description');
    expect(GUIDE_META_PROMPT).toMatch(/one or two sentences/i);
  });
});

describe('getLanguageSuffix', () => {
  it('returns empty string for English', () => {
    expect(getLanguageSuffix('en')).toBe('');
  });

  it('returns empty string for en-US', () => {
    expect(getLanguageSuffix('en-US')).toBe('');
  });

  it('writes the Spanish instruction in Spanish', () => {
    expect(getLanguageSuffix('es')).toContain('en español');
  });

  it('writes the French instruction in French', () => {
    expect(getLanguageSuffix('fr')).toContain('en français');
  });

  it('writes the Chinese instruction in Chinese', () => {
    expect(getLanguageSuffix('zh-CN')).toContain('请用中文输出');
  });

  it('writes the Brazilian Portuguese instruction in Portuguese', () => {
    expect(getLanguageSuffix('pt-BR')).toContain('português do Brasil');
  });

  it('matches a regional locale to its base language', () => {
    expect(getLanguageSuffix('fr-CA')).toBe(getLanguageSuffix('fr'));
  });

  it('falls back to the English instruction and the locale code for unknown languages', () => {
    const suffix = getLanguageSuffix('sv');
    expect(suffix).toContain('sv');
    expect(suffix).toContain('Write the output in');
  });

  it('writes every offered language its own instruction, never the English fallback', () => {
    for (const { code } of AI_LANGUAGES) {
      if (code === 'en') continue;
      expect(getLanguageSuffix(code)).not.toContain('Write the output in');
    }
  });

  it('writes the German instruction in German', () => {
    expect(getLanguageSuffix('de')).toContain('auf Deutsch');
  });

  it('tells every language to leave UI labels alone', () => {
    expect(getLanguageSuffix('es')).toContain('No traduzcas');
    expect(getLanguageSuffix('de')).toContain('Übersetze keine');
    expect(getLanguageSuffix('sv')).toContain('Never translate');
  });
});

describe('AI_LANGUAGES', () => {
  it('has 6 supported languages', () => {
    expect(AI_LANGUAGES).toHaveLength(6);
  });

  it('includes English as first entry', () => {
    expect(AI_LANGUAGES[0]).toEqual({ code: 'en', label: 'English' });
  });

  it('includes Simplified Chinese', () => {
    expect(AI_LANGUAGES).toContainEqual({ code: 'zh-CN', label: '中文' });
  });

  it('each entry has code and label', () => {
    for (const lang of AI_LANGUAGES) {
      expect(lang.code).toBeTruthy();
      expect(lang.label).toBeTruthy();
    }
  });
});
