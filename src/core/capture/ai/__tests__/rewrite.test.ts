import { describe, expect, it } from 'vitest';
import { REWRITE_PRESETS } from '../prompts';
import { buildRewritePrompt, cleanRewrite } from '../rewrite';

describe('cleanRewrite', () => {
  it('trims surrounding whitespace', () => {
    expect(cleanRewrite('  Click the Submit button  ')).toBe('Click the Submit button');
  });

  it('unwraps a fully quoted response', () => {
    expect(cleanRewrite('"Click the Submit button"')).toBe('Click the Submit button');
  });

  it('unwraps smart quotes', () => {
    expect(cleanRewrite('“Click the Submit button”')).toBe('Click the Submit button');
  });

  it('keeps an unmatched leading quote', () => {
    expect(cleanRewrite('"Submit" is the button label')).toBe('"Submit" is the button label');
  });

  it('keeps quotes that are internal to the text', () => {
    expect(cleanRewrite('Select the "Admin" role')).toBe('Select the "Admin" role');
  });

  it('unwraps across multiple lines', () => {
    expect(cleanRewrite('"line one\nline two"')).toBe('line one\nline two');
  });

  it('returns empty string for a blank response', () => {
    expect(cleanRewrite('   ')).toBe('');
  });
});

describe('buildRewritePrompt', () => {
  it('substitutes the selected text and the instruction', () => {
    const prompt = buildRewritePrompt('Click Save', 'Make it shorter.', 'en');
    expect(prompt).toContain('Click Save');
    expect(prompt).toContain('Make it shorter.');
    expect(prompt).not.toContain('{{text}}');
    expect(prompt).not.toContain('{{instruction}}');
  });

  it('does not interpret dollar patterns in the selected text', () => {
    const prompt = buildRewritePrompt('Enter $& in the Amount field', 'Fix grammar.', 'en');
    expect(prompt).toContain('Enter $& in the Amount field');
  });

  it('does not interpret dollar patterns in the instruction', () => {
    const prompt = buildRewritePrompt('Click Save', 'Replace $1 with $`', 'en');
    expect(prompt).toContain('Replace $1 with $`');
  });

  it('appends a language suffix for non-English locales', () => {
    expect(buildRewritePrompt('Click Save', 'Make it shorter.', 'fr')).toContain('en français');
  });

  it('appends nothing for English', () => {
    expect(buildRewritePrompt('Click Save', 'Make it shorter.', 'en')).not.toContain('IMPORTANT');
  });

  it('forbids inventing UI elements', () => {
    expect(buildRewritePrompt('Click Save', 'Expand it.', 'en')).toMatch(/never introduce a UI element/i);
  });

  it('works with every preset instruction', () => {
    for (const instruction of Object.values(REWRITE_PRESETS)) {
      expect(buildRewritePrompt('Click Save', instruction, 'en')).toContain(instruction);
    }
  });
});
