import { describe, expect, it } from 'vitest';
import { splitAtShortcut } from '../split-at-shortcut';

describe('splitAtShortcut', () => {
  it('splits a key step title around its shortcut', () => {
    expect(splitAtShortcut('Press ⌃S on "Search"', 'keydown:⌃S')).toEqual(['Press ', '⌃S', ' on "Search"']);
  });

  it('leaves other steps and titles without the shortcut alone', () => {
    expect(splitAtShortcut('Click "Save"', 'click')).toBeNull();
    expect(splitAtShortcut('Save the file', 'keydown:⌘S')).toBeNull();
  });
});
