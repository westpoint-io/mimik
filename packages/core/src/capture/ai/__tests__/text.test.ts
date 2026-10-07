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

  it('unwraps a whole description that also quotes a value', () => {
    expect(unwrapQuotes('"Select "Admin" from the Role dropdown"')).toBe('Select "Admin" from the Role dropdown');
    expect(unwrapQuotes('"在 Role 下拉菜单中选择 "Admin" 选项"')).toBe('在 Role 下拉菜单中选择 "Admin" 选项');
  });

  it('unwraps a whole description whose quoted value sits at either end', () => {
    expect(unwrapQuotes('""abc" in das Feld Email eingeben"')).toBe('"abc" in das Feld Email eingeben');
    expect(unwrapQuotes('"Type "abc""')).toBe('Type "abc"');
  });

  it('unwraps a whole description quoting a value before punctuation', () => {
    expect(unwrapQuotes('"Type "abc", then press Enter"')).toBe('Type "abc", then press Enter');
  });

  it('leaves a quote it cannot read as opening or closing', () => {
    expect(unwrapQuotes('"在Role下拉菜单中选择"Admin"选项"')).toBe('"在Role下拉菜单中选择"Admin"选项"');
  });

  it('leaves two quoted terms written without spaces as they are', () => {
    expect(unwrapQuotes('"设置"页面中点击"保存"')).toBe('"设置"页面中点击"保存"');
  });

  it('unwraps a whole description quoting a value that starts or ends with a symbol', () => {
    expect(unwrapQuotes('"Click "+ New""')).toBe('Click "+ New"');
    expect(unwrapQuotes('"Type "$100" in Amount"')).toBe('Type "$100" in Amount');
    expect(unwrapQuotes('"Select "(GMT-05:00) Eastern" from Time zone"')).toBe(
      'Select "(GMT-05:00) Eastern" from Time zone',
    );
  });

  it('drops the stray opening quote of a reply cut off by the token limit', () => {
    expect(unwrapQuotes('"Click Save')).toBe('Click Save');
  });

  it('leaves a lone quote standing between two spaces', () => {
    expect(unwrapQuotes('"Type " in Email"')).toBe('"Type " in Email"');
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
