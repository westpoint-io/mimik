import { describe, expect, it } from 'vitest';
import { unwrapQuotes } from '../text';

describe('unwrapQuotes', () => {
  it('unwraps a description the model wrapped whole', () => {
    expect(unwrapQuotes('"Click the Submit button"')).toBe('Click the Submit button');
  });

  it('trims before and after unwrapping', () => {
    expect(unwrapQuotes('  "Click Submit"  ')).toBe('Click Submit');
  });

  it('leaves a sentence that merely starts with a quoted value', () => {
    expect(unwrapQuotes('"abc" in das Feld Email eingeben')).toBe('"abc" in das Feld Email eingeben');
  });

  it('leaves a sentence that merely ends with a quoted value', () => {
    expect(unwrapQuotes('在 Email 字段中输入 "abc"')).toBe('在 Email 字段中输入 "abc"');
  });

  it('leaves a sentence quoted at both ends but holding two separate spans', () => {
    expect(unwrapQuotes('"Admin" in der Liste "Role"')).toBe('"Admin" in der Liste "Role"');
  });

  it('leaves an unquoted sentence alone', () => {
    expect(unwrapQuotes('Type "abc" in Email')).toBe('Type "abc" in Email');
  });

  it('handles a bare quote without dropping it', () => {
    expect(unwrapQuotes('"')).toBe('"');
  });

  it('returns an empty string for blank input', () => {
    expect(unwrapQuotes('   ')).toBe('');
  });
});
