import { describe, expect, it } from 'vitest';
import { MAX_TITLE_LENGTH, sanitizeGuideTitle, stripTitleLineBreaks } from '../title';

describe('sanitizeGuideTitle', () => {
  it('collapses a hard line break into a single space', () => {
    expect(sanitizeGuideTitle('Set up\nyour profile')).toBe('Set up your profile');
  });

  it('handles CRLF and runs of blank lines', () => {
    expect(sanitizeGuideTitle('Set up\r\n\r\n  your profile')).toBe('Set up your profile');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeGuideTitle('  Set up your profile \n')).toBe('Set up your profile');
  });

  it('leaves an already single-line title untouched', () => {
    expect(sanitizeGuideTitle('Set up your profile')).toBe('Set up your profile');
  });

  it('does not truncate, so existing long titles survive a re-save', () => {
    const long = 'a'.repeat(MAX_TITLE_LENGTH * 2);
    expect(sanitizeGuideTitle(long)).toBe(long);
  });
});

describe('stripTitleLineBreaks', () => {
  it('removes line breaks while leaving other whitespace alone mid-edit', () => {
    expect(stripTitleLineBreaks('Set up\nyour  profile ')).toBe('Set up your  profile ');
  });
});
