import { extractDomain, getMostCommonDomain } from '@mimik/core/guides/domain';
import { getDomainInitial } from '@mimik/ui';
import { describe, expect, it } from 'vitest';

describe('extractDomain', () => {
  it('extracts hostname from a full URL', () => {
    expect(extractDomain('https://github.com/westpoint-io/mimik')).toBe('github.com');
  });

  it('strips www prefix', () => {
    expect(extractDomain('https://www.example.com/page')).toBe('example.com');
  });

  it('returns empty string for invalid URL', () => {
    expect(extractDomain('not-a-url')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(extractDomain('')).toBe('');
  });

  it('handles URLs with ports', () => {
    expect(extractDomain('http://localhost:3000/dashboard')).toBe('localhost');
  });

  it('handles URLs with subdomains', () => {
    expect(extractDomain('https://docs.google.com/spreadsheets')).toBe('docs.google.com');
  });
});

describe('getMostCommonDomain', () => {
  it('returns the most frequent domain', () => {
    const steps = [{ url: 'https://github.com/a' }, { url: 'https://github.com/b' }, { url: 'https://google.com/c' }];
    expect(getMostCommonDomain(steps)).toBe('github.com');
  });

  it('returns empty string when no steps have URLs', () => {
    expect(getMostCommonDomain([{ url: null }, { url: '' }])).toBe('');
  });

  it('returns empty string for empty array', () => {
    expect(getMostCommonDomain([])).toBe('');
  });

  it('handles single step', () => {
    expect(getMostCommonDomain([{ url: 'https://example.com' }])).toBe('example.com');
  });
});

describe('getDomainInitial', () => {
  it('returns uppercase first letter', () => {
    const { letter } = getDomainInitial('github.com');
    expect(letter).toBe('G');
  });

  it('returns a gradient tuple', () => {
    const { gradient } = getDomainInitial('github.com');
    expect(gradient).toHaveLength(2);
    expect(gradient[0]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(gradient[1]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('returns consistent gradient for the same domain', () => {
    const a = getDomainInitial('example.com');
    const b = getDomainInitial('example.com');
    expect(a.gradient).toEqual(b.gradient);
  });
});
