import { describe, expect, it } from 'vitest';
import { commandShortcut } from '../command-shortcut';

const press = (code: string, held: Partial<KeyboardEvent> = {}) =>
  ({ code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...held }) as KeyboardEvent;

describe('commandShortcut', () => {
  it('builds a browser shortcut from the physical key', () => {
    expect(commandShortcut(press('KeyC', { altKey: true, shiftKey: true }), false)).toBe('Alt+Shift+C');
    expect(commandShortcut(press('Digit4', { ctrlKey: true }), false)).toBe('Ctrl+4');
    expect(commandShortcut(press('F5', { altKey: true }), false)).toBe('Alt+F5');
  });

  it('names the Mac modifiers the way the browser expects', () => {
    expect(commandShortcut(press('KeyR', { metaKey: true, shiftKey: true }), true)).toBe('Command+Shift+R');
    expect(commandShortcut(press('KeyR', { ctrlKey: true }), true)).toBe('MacCtrl+R');
  });

  it('waits for a usable combination', () => {
    expect(commandShortcut(press('ShiftLeft', { shiftKey: true }), false)).toBeNull();
    expect(commandShortcut(press('KeyC'), false)).toBeNull();
    expect(commandShortcut(press('KeyC', { shiftKey: true }), false)).toBeNull();
    expect(commandShortcut(press('Space', { altKey: true }), false)).toBeNull();
  });
});
