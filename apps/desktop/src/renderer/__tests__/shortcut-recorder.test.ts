import type React from 'react';
import { describe, expect, it } from 'vitest';
import { accelerator } from '../ShortcutRecorder';

const press = (key: string, held: Partial<Record<'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey', boolean>> = {}) =>
  ({ key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...held }) as React.KeyboardEvent;

describe('accelerator', () => {
  it('names a held combination the way Electron does', () => {
    expect(accelerator(press('s', { ctrlKey: true, shiftKey: true }))).toBe('Control+Shift+S');
    expect(accelerator(press('r', { altKey: true, shiftKey: true }))).toBe('Alt+Shift+R');
    expect(accelerator(press('F9', { ctrlKey: true }))).toBe('Control+F9');
  });

  it('refuses anything that would steal a bare key', () => {
    expect(accelerator(press('s'))).toBeNull();
    expect(accelerator(press('Enter'))).toBeNull();
  });

  it('ignores a modifier pressed on its own', () => {
    expect(accelerator(press('Shift', { shiftKey: true }))).toBeNull();
    expect(accelerator(press('Control', { ctrlKey: true }))).toBeNull();
  });
});
