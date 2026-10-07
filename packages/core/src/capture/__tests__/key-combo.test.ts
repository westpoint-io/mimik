import { describe, expect, it } from 'vitest';
import { keyCombo } from '../key-combo';

describe('keyCombo', () => {
  it('names the held keys and the key, so Ctrl+K never reads as k', () => {
    expect(keyCombo({ ctrl: true }, 'k', false)).toBe('Ctrl+K');
    expect(keyCombo({ ctrl: true, shift: true }, 'S', false)).toBe('Ctrl+Shift+S');
    expect(keyCombo({ alt: true }, 'F4', false)).toBe('Alt+F4');
  });

  it('keeps a named key as it is when nothing is held', () => {
    expect(keyCombo({}, 'Enter', false)).toBe('Enter');
    expect(keyCombo({}, 'ArrowDown', false)).toBe('ArrowDown');
  });

  it('writes a Mac shortcut with the Mac symbols', () => {
    expect(keyCombo({ meta: true }, 'k', true)).toBe('⌘K');
    expect(keyCombo({ meta: true, shift: true, alt: true }, 'S', true)).toBe('⌥⇧⌘S');
  });
});
