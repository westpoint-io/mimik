import { describe, expect, it } from 'vitest';
import { findMatches, PRESET_LABELS, PRESET_REGEXES, type PresetKey } from '../regexes';

const UK_KEYS: PresetKey[] = ['ukPhone', 'ukPostcode', 'ukNino', 'ukSortCode'];

const fresh = (key: PresetKey) => {
  const r = PRESET_REGEXES[key];
  r.lastIndex = 0;
  return r;
};

describe('UK preset registration', () => {
  it('carries a label for every UK preset', () => {
    for (const key of UK_KEYS) {
      expect(PRESET_LABELS[key]).toBeDefined();
      expect(PRESET_LABELS[key].length).toBeGreaterThan(0);
    }
  });
});

describe('ukPhone', () => {
  it.each([
    '07700 900461',
    '07700900461',
    '+44 7700 900461',
    '+447700900461',
    '0113 496 0122',
    '(020) 7946 0958',
    '020 7946 0958',
    '+44 (0)20 7946 0958',
    '+44(0)7700900461',
  ])('matches %s', (value) => {
    expect(value).toMatch(fresh('ukPhone'));
  });

  it('finds a number embedded in prose', () => {
    const match = fresh('ukPhone').exec('Call us on 07700 900461 before noon.');
    expect(match?.[0]).toBe('07700 900461');
  });

  it.each([
    '12345678',
    '1234 5678',
    'Order 2024 20260401',
    '01/02/2026',
    'Total is 1234.56',
  ])('leaves %s alone, unlike the general phone preset', (value) => {
    expect(value).not.toMatch(fresh('ukPhone'));
  });

  it('does not fire mid-way through a longer digit run', () => {
    expect('9077009004619').not.toMatch(fresh('ukPhone'));
  });
});

describe('ukPostcode', () => {
  it.each(['SW1A 2AA', 'M160RA', 'sw1a 2aa', 'EC1A 1BB', 'LS1 4AP'])('matches %s', (value) => {
    expect(value).toMatch(fresh('ukPostcode'));
  });

  it.each(['A1 servicing', 'room B2 4people', 'HELLO WORLD', '12345'])('leaves %s alone', (value) => {
    expect(value).not.toMatch(fresh('ukPostcode'));
  });
});

describe('ukNino', () => {
  it.each(['QQ 12 34 56 C', 'QQ123456C', 'ab 12 34 56 d'])('matches %s', (value) => {
    expect(value).toMatch(fresh('ukNino'));
  });

  it.each(['Q1 12 34 56 C', 'QQ 12 34 56 E', 'QQ 12 34 56'])('leaves %s alone', (value) => {
    expect(value).not.toMatch(fresh('ukNino'));
  });
});

describe('ukSortCode', () => {
  it.each(['04-00-04', '12-34-56'])('matches %s', (value) => {
    expect(value).toMatch(fresh('ukSortCode'));
  });

  it.each(['123-45-67', '12-345-56', '1234-56-78', '12/34/56'])('leaves %s alone', (value) => {
    expect(value).not.toMatch(fresh('ukSortCode'));
  });

  it('does not extend into neighbouring digits', () => {
    expect('112-34-56').not.toMatch(fresh('ukSortCode'));
    expect('12-34-567').not.toMatch(fresh('ukSortCode'));
  });
});

describe('UK patterns through the scanner round trip', () => {
  it.each([
    ['ukPhone', 'Ring +44 (0)20 7946 0958 today'],
    ['ukPostcode', 'Deliver to SW1A 2AA please'],
    ['ukNino', 'NINO QQ123456C on file'],
    ['ukSortCode', 'Sort code 04-00-04 applies'],
  ] as [PresetKey, string][])('%s survives new RegExp(source, flags) and findMatches', (key, text) => {
    const original = PRESET_REGEXES[key];
    const rebuilt = new RegExp(original.source, original.flags);
    expect(findMatches(text, [rebuilt]).length).toBeGreaterThan(0);
  });
});

describe('the general phone preset is untouched', () => {
  it('still matches what it matched before', () => {
    const r = PRESET_REGEXES.phone;
    r.lastIndex = 0;
    expect('(555) 014-2378').toMatch(r);
  });
});
