import { describe, expect, it } from 'vitest';
import { MIN_BARE_SCRUB, SCRUB_PLACEHOLDER, scrubValues, typedValues } from '../scrub';

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
