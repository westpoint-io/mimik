import { describe, expect, it } from 'vitest';
import { formatExamples, resolveExamples } from '../examples';
import { AI_LANGUAGES } from '../prompts';

const TITLE_LIMIT = 60;

describe('resolveExamples', () => {
  it('has its own examples for every offered language, not the English fallback', () => {
    const english = resolveExamples('en');
    for (const { code } of AI_LANGUAGES) {
      const examples = resolveExamples(code);
      expect(examples.steps.length).toBeGreaterThan(0);
      expect(examples.titles.length).toBeGreaterThan(0);
      expect(examples.descriptions.length).toBeGreaterThan(0);
      if (code !== 'en') expect(examples).not.toBe(english);
    }
  });

  it('matches a regional locale to its base language', () => {
    expect(resolveExamples('fr-CA')).toBe(resolveExamples('fr'));
    expect(resolveExamples('pt')).toBe(resolveExamples('pt-BR'));
  });

  it('falls back to English for an unknown locale', () => {
    expect(resolveExamples('sv')).toBe(resolveExamples('en'));
  });

  it('keeps every title example under the limit the prompt states', () => {
    for (const { code } of AI_LANGUAGES) {
      for (const title of resolveExamples(code).titles) {
        expect(title.length).toBeLessThan(TITLE_LIMIT);
      }
    }
  });

  it('leaves UI labels and product names untranslated, so the examples teach the rule', () => {
    for (const { code } of AI_LANGUAGES) {
      const { steps, titles } = resolveExamples(code);
      expect(steps.join(' ')).toContain('Submit');
      expect(steps.join(' ')).toContain('Settings');
      expect(titles.join(' ')).toContain('claude-code');
      expect(titles.join(' ')).toContain('Workday');
    }
  });

  it('quotes values with straight quotes, which is what redaction matches on', () => {
    for (const { code } of AI_LANGUAGES) {
      const text = resolveExamples(code).steps.join(' ');
      expect(text).not.toMatch(/[“”«»]/);
    }
  });
});

describe('formatExamples', () => {
  it('renders one bullet per line', () => {
    expect(formatExamples(['One', 'Two'])).toBe('- One\n- Two');
  });

  it('does not wrap a line that already quotes a value', () => {
    expect(formatExamples(['Select "Admin" from the Role dropdown'])).toBe('- Select "Admin" from the Role dropdown');
  });

  it('never starts or ends an example with a quote, which the description unwrapper would strip', () => {
    for (const { code } of AI_LANGUAGES) {
      const examples = resolveExamples(code);
      for (const line of [...examples.steps, ...examples.titles, ...examples.descriptions]) {
        expect(line.startsWith('"')).toBe(false);
        expect(line.endsWith('"')).toBe(false);
      }
    }
  });

  it('keeps every rendered example free of nested quote collisions', () => {
    for (const { code } of AI_LANGUAGES) {
      for (const line of formatExamples(resolveExamples(code).steps).split('\n')) {
        expect(line).not.toMatch(/^- ".*".*"/);
      }
    }
  });
});
