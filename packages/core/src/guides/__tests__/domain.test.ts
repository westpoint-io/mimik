import { describe, expect, it } from 'vitest';
import { extractDomain, extractOrigin, getMostCommonDomain, getMostCommonOrigin } from '../domain';

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

describe('getMostCommonOrigin', () => {
  it('picks the origin most steps are on and skips pages that are not web pages', () => {
    const steps = [
      { url: 'chrome://extensions' },
      { url: 'chrome://extensions' },
      { url: 'https://app.example.com/a' },
      { url: 'https://app.example.com/b' },
      { url: 'https://accounts.example.com/login' },
    ];
    expect(getMostCommonOrigin(steps)).toBe('https://app.example.com');
    expect(extractOrigin('file:///tmp/a.html')).toBe('');
  });
});
