import { describe, expect, it } from 'vitest';
import { isRecordableKey } from '../is-recordable-key';

const press = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

describe('isRecordableKey', () => {
  it('records shortcuts and named keys, like the desktop', () => {
    expect(isRecordableKey(press('s', { ctrlKey: true }))).toBe(true);
    expect(isRecordableKey(press('k', { metaKey: true }))).toBe(true);
    expect(isRecordableKey(press('Enter'))).toBe(true);
    expect(isRecordableKey(press('ArrowDown'))).toBe(true);
  });

  it('skips plain characters and a modifier pressed on its own', () => {
    expect(isRecordableKey(press('a'))).toBe(false);
    expect(isRecordableKey(press('A'))).toBe(false);
    expect(isRecordableKey(press('Shift'))).toBe(false);
    expect(isRecordableKey(press('Control', { ctrlKey: true }))).toBe(false);
  });
});
