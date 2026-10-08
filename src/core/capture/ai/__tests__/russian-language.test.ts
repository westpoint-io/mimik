import { describe, expect, it } from 'vitest';
import { formatExamples, resolveExamples } from '../examples';
import { AI_LANGUAGES, getLanguageSuffix } from '../prompts';

const RUSSIAN_LOCALES = ['ru', 'ru-RU', 'ru-KZ', 'ru-BY', 'RU', ' RU-ru '] as const;

describe('Russian AI descriptions', () => {
  it('offers Russian exactly once without changing the existing languages', () => {
    expect(AI_LANGUAGES.map(({ code }) => code)).toEqual(['en', 'zh-CN', 'es', 'pt-BR', 'fr', 'de', 'ru']);
    expect(AI_LANGUAGES.find(({ code }) => code === 'ru')?.label).toBe('Русский');
  });

  it.each(RUSSIAN_LOCALES)('uses the Russian instruction for %s', (locale) => {
    const instruction = getLanguageSuffix(locale);
    expect(instruction).toBe(getLanguageSuffix('ru'));
    expect(instruction).toContain('на русском языке');
    expect(instruction).toContain('Не переводи названия');
    expect(instruction).toContain('U+0022');
    expect(instruction).not.toContain('IMPORTANT: Write the output in');
  });

  it.each(RUSSIAN_LOCALES)('uses the Russian examples for %s', (locale) => {
    const examples = resolveExamples(locale);
    expect(examples).toBe(resolveExamples('ru'));
    expect(examples).not.toBe(resolveExamples('en'));
    expect(examples.steps[0]).toBe('Нажмите кнопку Submit');
    expect(examples.titles).toContain('Настройка уведомлений Slack');
  });

  it('uses Russian prose while preserving site labels and product names', () => {
    const examples = resolveExamples('ru');
    const steps = examples.steps.join(' ');
    for (const label of ['Submit', 'Email', 'Admin', 'Role', 'Settings']) {
      expect(steps).toContain(label);
    }
    for (const name of ['claude-code', 'Slack', 'Workday', 'GitHub']) {
      expect(examples.titles.join(' ')).toContain(name);
    }
    for (const title of examples.titles) {
      expect(title.length).toBeLessThan(60);
      expect(title).not.toMatch(/[\r\n]/);
    }
  });

  it('models straight quotes around typed values for bundle redaction', () => {
    const steps = resolveExamples('ru').steps;
    expect(steps).toContain('Введите "example@example.com" в поле Email');
    expect(steps.join(' ')).not.toMatch(/[“”«»]/);
    expect(formatExamples(steps).split('\n')).toHaveLength(steps.length);
  });

  it('keeps the English and unknown-locale fallbacks unchanged', () => {
    expect(getLanguageSuffix('en-US')).toBe('');
    expect(resolveExamples('sv')).toBe(resolveExamples('en'));
    expect(getLanguageSuffix('sv')).toContain('Write the output in sv');
  });
});
