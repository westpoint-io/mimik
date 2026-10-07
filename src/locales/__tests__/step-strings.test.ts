import { describe, expect, it } from 'vitest';
import { unwrapQuotes } from '@/core/capture/ai/text';
import { SCRUB_PLACEHOLDER, scrubValues, typedValues } from '@/core/transfer/scrub';
import { LOCALES, renderMessage } from './read-locale';

function describeTyping(locale: string, value: string, label: string): string {
  return renderMessage(locale, 'steps.typeValueInto', [value, label]);
}

describe('localized typing step descriptions', () => {
  it.each(LOCALES)('%s wraps the typed value in straight double quotes', (locale) => {
    const description = describeTyping(locale, 'hunter2', 'Password');
    expect(description).toContain('"hunter2"');
    expect(description).not.toMatch(/[“”«»「」]/);
  });

  it.each(LOCALES)('%s names the field as well as the value', (locale) => {
    expect(describeTyping(locale, 'hunter2', 'Password')).toContain('Password');
  });

  it.each(LOCALES)('%s clears a field without echoing any value', (locale) => {
    const cleared = renderMessage(locale, 'steps.clearField', ['Password']);
    expect(cleared).toContain('Password');
    expect(cleared).not.toContain('"');
  });
});

describe('bundle redaction over localized descriptions', () => {
  const cases = [
    { name: 'a short value only the quoted path can catch', value: 'abc' },
    { name: 'a long value', value: 'hunter2-secret-value' },
    { name: 'a value containing regex metacharacters', value: 'a.b*c+d' },
    { name: 'a value that looks like a substitution token', value: '$1$2' },
  ];

  for (const { name, value } of cases) {
    it.each(LOCALES)(`%s redacts ${name}`, (locale) => {
      const description = describeTyping(locale, value, 'Password');
      expect(description).toContain(value);

      const scrubbed = scrubValues(description, typedValues([{ inputValue: value }]));
      expect(scrubbed).not.toContain(value);
      expect(scrubbed).toContain(SCRUB_PLACEHOLDER);
    });
  }
});

describe('bundle redaction over AI-written descriptions', () => {
  const shapes = [
    { name: 'a sentence opening with the quoted value', text: '"$1" in das Feld $2 eingeben' },
    { name: 'a sentence closing with the quoted value', text: '在 $2 字段中输入 "$1"' },
    { name: 'a sentence quoting the value mid-way', text: 'Type "$1" in $2' },
    { name: 'a description the model wrapped whole', text: '"Type "$1" in $2"' },
  ];

  for (const { name, text } of shapes) {
    it(`redacts a short value in ${name}`, () => {
      const written = unwrapQuotes(text.replace('$1', 'abc').replace('$2', 'Email'));
      const scrubbed = scrubValues(written, typedValues([{ inputValue: 'abc' }]));
      expect(scrubbed).not.toContain('abc');
      expect(scrubbed).toContain(SCRUB_PLACEHOLDER);
    });
  }
});
