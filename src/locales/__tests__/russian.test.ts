import { describe, expect, it } from 'vitest';
import { SCRUB_PLACEHOLDER, scrubValues, typedValues } from '@/core/transfer/scrub';
import { localeKeys, localeMessage, renderMessage } from './read-locale';

describe('Russian interface messages', () => {
  it('covers every English message exactly once', () => {
    const keys = localeKeys('ru');
    expect(keys).toEqual(localeKeys('en'));
    expect(new Set(keys).size).toBe(keys.length);
    expect(localeMessage('ru', 'meta.locale')).toBe('ru');
  });

  it('preserves all ordered substitution placeholders', () => {
    for (const key of localeKeys('en')) {
      const source = localeMessage('en', key);
      const translation = localeMessage('ru', key);
      expect(translation.trim().length).toBeGreaterThan(0);
      expect(translation.match(/\$\d+/g) ?? []).toEqual(source.match(/\$\d+/g) ?? []);
    }
  });

  it('distinguishes recorded comments from generated video speech', () => {
    expect(localeMessage('ru', 'settings.voiceNarration')).toBe('Голосовые комментарии');
    expect(localeMessage('ru', 'settings.voiceover')).toBe('Озвучивание видео');
    expect(localeMessage('ru', 'settings.speechToText')).toBe('речь → текст');
    expect(localeMessage('ru', 'settings.textToSpeech')).toBe('текст → речь');
  });

  it.each([
    '0',
    '1',
    '2',
    '5',
    '11',
    '21',
    '22',
    '25',
    '101',
  ])('renders the count-neutral plural message for %s', (count) => {
    expect(renderMessage('ru', 'fullview.stepCountPlural', [count])).toBe(`Шагов: ${count}`);
    expect(renderMessage('ru', 'videoPlayer.stepCount', [count])).toBe(`Шагов: ${count}`);
  });

  it.each([
    'абв',
    '5',
    'abc',
    '$1$2',
    'a.b*c+d',
  ])('allows the existing redactor to remove a typed value: %s', (value) => {
    const description = renderMessage('ru', 'steps.typeValueInto', [value, 'Email']);
    expect(description).toBe(`Введите "${value}" в Email`);
    const redacted = scrubValues(description, typedValues([{ inputValue: value }]));
    expect(redacted).not.toContain(value);
    expect(redacted).toContain(SCRUB_PLACEHOLDER);
    expect(redacted).toContain('Email');
  });

  it('preserves Cyrillic labels and does not recursively expand typed placeholders', () => {
    expect(renderMessage('ru', 'steps.typeValueInto', ['$1$2', 'Название'])).toBe('Введите "$1$2" в Название');
    expect(renderMessage('ru', 'export.stepsRange', ['1', '3', '7'])).toBe('Шаги 1–3 из 7');
  });

  it('keeps the manifest description within the store limit', () => {
    expect(localeMessage('ru', 'app.description').length).toBeLessThanOrEqual(132);
  });
});
