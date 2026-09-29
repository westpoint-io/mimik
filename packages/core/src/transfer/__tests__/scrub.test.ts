import { describe, expect, it } from 'vitest';
import { MIN_BARE_SCRUB, SCRUB_PLACEHOLDER, scrubUrl, scrubValues, typedValues } from '../scrub';

describe('scrubValues', () => {
  it('removes the value from the description the capture pipeline writes', () => {
    const description = 'Type "hunter2-secret-value" in Search with DuckDuckGo';
    expect(scrubValues(description, ['hunter2-secret-value'])).toBe(
      `Type "${SCRUB_PLACEHOLDER}" in Search with DuckDuckGo`,
    );
  });

  it('removes a bare occurrence an AI description could have written', () => {
    expect(scrubValues('Search for hunter2-secret-value and open the result', ['hunter2-secret-value'])).toBe(
      `Search for ${SCRUB_PLACEHOLDER} and open the result`,
    );
  });

  it('removes every occurrence, not just the first', () => {
    const out = scrubValues('Type "sekrit" then check sekrit appears', ['sekrit']);
    expect(out).not.toContain('sekrit');
  });

  it('ignores case, since a rewritten description may recapitalise', () => {
    expect(scrubValues('The value Sekrit-Value was entered', ['sekrit-value'])).toBe(
      `The value ${SCRUB_PLACEHOLDER} was entered`,
    );
  });

  it('treats the value as text, not as a pattern', () => {
    expect(scrubValues('Type "a.b*c" in Field', ['a.b*c'])).toBe(`Type "${SCRUB_PLACEHOLDER}" in Field`);
    expect(scrubValues('Type "axbyc" in Field', ['a.b*c'])).toContain('axbyc');
  });

  it('quotes the short value but leaves the prose around it alone', () => {
    const short = 'no';
    expect(short.length).toBeLessThan(MIN_BARE_SCRUB);

    const out = scrubValues('Type "no" in Comment, then note it is not done', [short]);
    expect(out).toBe(`Type "${SCRUB_PLACEHOLDER}" in Comment, then note it is not done`);
    expect(out).toContain('note it is not done');
  });

  it('scrubs a longer value before the shorter one it contains', () => {
    const out = scrubValues(
      'Type "acme-corp-token" in Key',
      typedValues([{ inputValue: 'acme' }, { inputValue: 'acme-corp-token' }]),
    );
    expect(out).toBe(`Type "${SCRUB_PLACEHOLDER}" in Key`);
  });

  it('leaves text untouched when there is nothing to scrub', () => {
    expect(scrubValues('Click the Save button', [])).toBe('Click the Save button');
    expect(scrubValues('Click the Save button', ['', '   '])).toBe('Click the Save button');
  });
});

describe('typedValues', () => {
  it('collects distinct values, longest first', () => {
    expect(
      typedValues([
        { inputValue: 'short' },
        { inputValue: 'a much longer value' },
        { inputValue: 'short' },
        {},
        { inputValue: '  ' },
      ]),
    ).toEqual(['a much longer value', 'short']);
  });
});

describe('scrubUrl', () => {
  it('never touches the scheme or host, even when a typed value matches them', () => {
    expect(scrubUrl('https://github.com/search?q=github', ['github'])).toBe(
      `https://github.com/search?q=${encodeURIComponent(SCRUB_PLACEHOLDER)}`,
    );
  });

  it('finds a value the browser form-encoded', () => {
    const url = scrubUrl('https://a.example/s?q=%28555%29+123-4567&page=2', ['(555) 123-4567']);
    expect(url).toBe(`https://a.example/s?q=${encodeURIComponent(SCRUB_PLACEHOLDER)}&page=2`);
  });

  it('removes a short value that is a whole query value', () => {
    expect(scrubUrl('https://a.example/check?pin=123', ['123'])).toBe(
      `https://a.example/check?pin=${encodeURIComponent(SCRUB_PLACEHOLDER)}`,
    );
  });

  it('removes a value from a path segment and the fragment', () => {
    const url = scrubUrl('https://a.example/users/jane%40corp.com#jane@corp.com', ['jane@corp.com']);
    expect(url).not.toContain('jane');
    expect(url.startsWith('https://a.example/users/')).toBe(true);
  });

  it('returns the URL untouched when nothing in it was typed', () => {
    const url = 'https://a.example/a%20b?x=1+2';
    expect(scrubUrl(url, ['hunter2'])).toBe(url);
  });

  it('does not throw on a value cut through the middle of an emoji', () => {
    const cut = `${'a'.repeat(79)}😀`.slice(0, 80);
    expect(() => scrubUrl('https://a.example/?q=x', [cut])).not.toThrow();
  });

  it('keeps the shape of a URL that ends in a bare ? or #', () => {
    const placeholder = encodeURIComponent(SCRUB_PLACEHOLDER);
    expect(scrubUrl('https://a.example/users/hunter22?', ['hunter22'])).toBe(`https://a.example/users/${placeholder}`);
    expect(scrubUrl('https://a.example/users/hunter22#', ['hunter22'])).toBe(`https://a.example/users/${placeholder}`);
  });

  it('scrubs an opaque URL as plain text, since it has no host to protect', () => {
    expect(scrubUrl('data:text/plain,hunter22', ['hunter22'])).toBe(`data:text/plain,${SCRUB_PLACEHOLDER}`);
  });
});
