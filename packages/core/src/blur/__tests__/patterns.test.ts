import { describe, expect, it } from 'vitest';
import { PRESET_LABELS, type PresetKey, patternsFor, sensitiveSpans } from '../patterns';

const PRESET_REGEXES = Object.fromEntries(
  (['email', 'phone', 'ssn', 'creditCard', 'ipAddress', 'macAddress'] as const).map((kind) => [
    kind,
    patternsFor([kind])[0],
  ]),
) as Record<PresetKey, RegExp>;

describe('PRESET_LABELS', () => {
  it('has a label for every preset key', () => {
    const keys: PresetKey[] = ['email', 'phone', 'ssn', 'creditCard', 'ipAddress', 'macAddress'];
    for (const key of keys) {
      expect(PRESET_LABELS[key]).toBeDefined();
      expect(typeof PRESET_LABELS[key]).toBe('string');
      expect(PRESET_LABELS[key].length).toBeGreaterThan(0);
    }
  });
});

describe('email regex', () => {
  const regex = () => {
    const r = PRESET_REGEXES.email;
    r.lastIndex = 0;
    return r;
  };

  it('matches standard email addresses', () => {
    expect('user@example.com').toMatch(regex());
    expect('john.doe@company.org').toMatch(regex());
    expect('name+tag@domain.co').toMatch(regex());
  });

  it('matches emails with numbers and special chars in local part', () => {
    expect('user123@test.com').toMatch(regex());
    expect('first.last@sub.domain.com').toMatch(regex());
    expect('a%b@example.com').toMatch(regex());
  });

  it('matches email embedded in surrounding text', () => {
    const r = regex();
    const match = r.exec('Contact us at support@acme.com for help');
    expect(match).not.toBeNull();
    expect(match![0]).toBe('support@acme.com');
  });

  it('does not match strings without @', () => {
    expect('notanemail.com').not.toMatch(regex());
  });

  it('does not match strings without TLD', () => {
    expect('user@localhost').not.toMatch(regex());
  });

  it('is case insensitive', () => {
    expect('USER@EXAMPLE.COM').toMatch(regex());
    expect('User@Example.Com').toMatch(regex());
  });
});

describe('phone regex', () => {
  const regex = () => {
    const r = PRESET_REGEXES.phone;
    r.lastIndex = 0;
    return r;
  };

  it('matches US phone numbers', () => {
    expect('555-123-4567').toMatch(regex());
    expect('(555) 123-4567').toMatch(regex());
    expect('555.123.4567').toMatch(regex());
  });

  it('matches international format with country code', () => {
    expect('+1 555-123-4567').toMatch(regex());
    expect('+44 20 7946 0958').toMatch(regex());
  });

  it('matches phone number embedded in text', () => {
    const r = regex();
    const match = r.exec('Call me at 555-123-4567 please');
    expect(match).not.toBeNull();
  });

  it('matches numbers without separators', () => {
    expect('5551234567').toMatch(regex());
  });

  it('matches UK numbers', () => {
    expect('07700 900461').toMatch(regex());
    expect('+44 7700 900461').toMatch(regex());
    expect('0113 496 0122').toMatch(regex());
    expect('07700900461').toMatch(regex());
  });

  it('does not match plain reference numbers, quantities or dates', () => {
    expect('12345678').not.toMatch(regex());
    expect('1234 5678').not.toMatch(regex());
    expect('Order 2024 20260401').not.toMatch(regex());
    expect('Qty 500 1000').not.toMatch(regex());
  });
});

describe('SSN regex', () => {
  const regex = () => {
    const r = PRESET_REGEXES.ssn;
    r.lastIndex = 0;
    return r;
  };

  it('matches SSN with dashes', () => {
    expect('123-45-6789').toMatch(regex());
  });

  it('matches SSN without dashes', () => {
    expect('123456789').toMatch(regex());
  });

  it('matches SSN embedded in text', () => {
    const r = regex();
    const match = r.exec('SSN: 123-45-6789 on file');
    expect(match).not.toBeNull();
    expect(match![0]).toBe('123-45-6789');
  });

  it('does not match numbers with too few digits', () => {
    expect('12-34-567').not.toMatch(regex());
  });

  it('does not match numbers with too many digits', () => {
    const r = regex();
    const text = '1234567890';
    const match = r.exec(text);
    if (match) {
      expect(match[0]).not.toBe(text);
    }
  });

  it('matches at line boundaries', () => {
    const r = regex();
    const match = r.exec('123-45-6789');
    expect(match).not.toBeNull();
    expect(match!.index).toBe(0);
  });
});

describe('credit card regex', () => {
  const regex = () => {
    const r = PRESET_REGEXES.creditCard;
    r.lastIndex = 0;
    return r;
  };

  it('matches 16-digit card number without separators', () => {
    expect('4111111111111111').toMatch(regex());
  });

  it('matches card number with spaces', () => {
    expect('4111 1111 1111 1111').toMatch(regex());
  });

  it('matches card number with dashes', () => {
    expect('4111-1111-1111-1111').toMatch(regex());
  });

  it('matches 13-digit card numbers (old Visa)', () => {
    expect('4222222222222').toMatch(regex());
  });

  it('matches 15-digit card numbers (Amex)', () => {
    expect('378282246310005').toMatch(regex());
  });

  it('matches card number embedded in text', () => {
    const r = regex();
    const match = r.exec('Card: 4111111111111111 on file');
    expect(match).not.toBeNull();
  });
});

describe('IP address regex', () => {
  const regex = () => {
    const r = PRESET_REGEXES.ipAddress;
    r.lastIndex = 0;
    return r;
  };

  it('matches valid IPv4 addresses', () => {
    expect('192.168.1.1').toMatch(regex());
    expect('10.0.0.1').toMatch(regex());
    expect('255.255.255.255').toMatch(regex());
    expect('0.0.0.0').toMatch(regex());
  });

  it('matches loopback address', () => {
    expect('127.0.0.1').toMatch(regex());
  });

  it('does not match octets above 255', () => {
    expect('256.1.1.1').not.toMatch(regex());
    expect('1.1.1.256').not.toMatch(regex());
  });

  it('does not match incomplete IP addresses', () => {
    expect('192.168.1').not.toMatch(regex());
  });

  it('matches IP embedded in text', () => {
    const r = regex();
    const match = r.exec('Server at 10.0.0.42 is down');
    expect(match).not.toBeNull();
    expect(match![0]).toBe('10.0.0.42');
  });

  it('does not match version numbers like 1.2.3', () => {
    expect('1.2.3').not.toMatch(regex());
  });

  it('matches addresses with single-digit octets', () => {
    expect('1.2.3.4').toMatch(regex());
  });

  it('matches addresses with leading zeros in octets', () => {
    expect('01.02.03.04').toMatch(regex());
  });
});

describe('MAC address regex', () => {
  const regex = () => {
    const r = PRESET_REGEXES.macAddress;
    r.lastIndex = 0;
    return r;
  };

  it('matches colon-separated MAC address', () => {
    expect('00:1A:2B:3C:4D:5E').toMatch(regex());
  });

  it('matches dash-separated MAC address', () => {
    expect('00-1A-2B-3C-4D-5E').toMatch(regex());
  });

  it('is case insensitive', () => {
    expect('aa:bb:cc:dd:ee:ff').toMatch(regex());
    expect('AA:BB:CC:DD:EE:FF').toMatch(regex());
  });

  it('does not match incomplete MAC addresses', () => {
    expect('00:1A:2B:3C:4D').not.toMatch(regex());
  });

  it('matches MAC embedded in text', () => {
    const r = regex();
    const match = r.exec('Device MAC: AA:BB:CC:DD:EE:FF found');
    expect(match).not.toBeNull();
    expect(match![0]).toBe('AA:BB:CC:DD:EE:FF');
  });

  it('does not match if segments have wrong length', () => {
    expect('0:1A:2B:3C:4D:5E').not.toMatch(regex());
  });
});

describe('sensitiveSpans', () => {
  it('returns empty array for empty input', () => {
    expect(sensitiveSpans('', [PRESET_REGEXES.email])).toEqual([]);
  });

  it('returns empty array when no patterns match', () => {
    expect(sensitiveSpans('no sensitive data here', [PRESET_REGEXES.email])).toEqual([]);
  });

  it('returns empty array when patterns list is empty', () => {
    expect(sensitiveSpans('user@example.com', [])).toEqual([]);
  });

  it('returns correct indices for a single match', () => {
    const text = 'Email: user@example.com here';
    const results = sensitiveSpans(text, [PRESET_REGEXES.email]);
    expect(results).toHaveLength(1);
    expect(results[0]!.start).toBe(7);
    expect(results[0]!.end).toBe(23);
    expect(text.slice(results[0]!.start, results[0]!.end)).toBe('user@example.com');
  });

  it('returns multiple non-overlapping matches', () => {
    const text = 'Email user@a.com and admin@b.org please';
    const results = sensitiveSpans(text, [PRESET_REGEXES.email]);
    expect(results).toHaveLength(2);
    expect(text.slice(results[0]!.start, results[0]!.end)).toBe('user@a.com');
    expect(text.slice(results[1]!.start, results[1]!.end)).toBe('admin@b.org');
  });

  it('merges overlapping ranges from different patterns', () => {
    const text = '123-45-6789';
    const results = sensitiveSpans(text, [PRESET_REGEXES.ssn, PRESET_REGEXES.phone]);
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.start).toBeGreaterThanOrEqual(results[i - 1]!.end);
    }
  });

  it('merges adjacent ranges', () => {
    const fakePattern1 = /abc/g;
    const fakePattern2 = /bcd/g;
    const text = 'abcd';
    const results = sensitiveSpans(text, [fakePattern1, fakePattern2]);
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ start: 0, end: 4 });
  });

  it('handles multiple pattern types simultaneously', () => {
    const text = 'Email: user@test.com Phone: 555-123-4567 IP: 192.168.1.1';
    const results = sensitiveSpans(text, [PRESET_REGEXES.email, PRESET_REGEXES.phone, PRESET_REGEXES.ipAddress]);
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('returns ranges sorted by start position', () => {
    const text = 'IP: 10.0.0.1 Email: z@a.com SSN: 123-45-6789';
    const results = sensitiveSpans(text, [PRESET_REGEXES.ssn, PRESET_REGEXES.email, PRESET_REGEXES.ipAddress]);
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.start).toBeGreaterThanOrEqual(results[i - 1]!.start);
    }
  });

  it('handles text with only whitespace', () => {
    expect(sensitiveSpans('   \n\t  ', [PRESET_REGEXES.email])).toEqual([]);
  });

  it('resets lastIndex between calls', () => {
    const text = 'user@a.com';
    sensitiveSpans(text, [PRESET_REGEXES.email]);
    const second = sensitiveSpans(text, [PRESET_REGEXES.email]);
    expect(second).toHaveLength(1);
  });

  it('does not produce overlapping ranges in output', () => {
    const text = 'Contact: 123-45-6789 or 123-456-7890';
    const results = sensitiveSpans(text, [PRESET_REGEXES.ssn, PRESET_REGEXES.phone]);
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.start).toBeGreaterThanOrEqual(results[i - 1]!.end);
    }
  });

  it('handles match at the very start of the string', () => {
    const text = 'user@test.com is an email';
    const results = sensitiveSpans(text, [PRESET_REGEXES.email]);
    expect(results[0]!.start).toBe(0);
  });

  it('handles match at the very end of the string', () => {
    const text = 'Send to user@test.com';
    const results = sensitiveSpans(text, [PRESET_REGEXES.email]);
    expect(results[results.length - 1]!.end).toBe(text.length);
  });
});

describe('PRESET_REGEXES', () => {
  it('has an entry for every PresetKey', () => {
    const keys: PresetKey[] = ['email', 'phone', 'ssn', 'creditCard', 'ipAddress', 'macAddress'];
    for (const key of keys) {
      expect(PRESET_REGEXES[key]).toBeInstanceOf(RegExp);
    }
  });

  it('all patterns have the global flag', () => {
    for (const pattern of Object.values(PRESET_REGEXES)) {
      expect(pattern.flags).toContain('g');
    }
  });
});

describe('patternsFor', () => {
  it('maps only the categories that are switched on', () => {
    expect(patternsFor(['email', 'ssn'])).toHaveLength(2);
    expect(patternsFor([])).toHaveLength(0);
  });

  it('hands out fresh regexes so a stale lastIndex cannot drop a match', () => {
    const [first] = patternsFor(['email']);
    first!.exec('contact me at a@b.co please');
    expect(first!.lastIndex).toBeGreaterThan(0);

    const [second] = patternsFor(['email']);
    expect(second).not.toBe(first);
    expect(second!.lastIndex).toBe(0);
    expect(sensitiveSpans('a@b.co', patternsFor(['email']))).toHaveLength(1);
  });
});
