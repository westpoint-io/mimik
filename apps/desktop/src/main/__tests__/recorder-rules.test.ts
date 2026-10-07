import { keyCombo } from '@mimik/core/capture/key-combo';
import { describe, expect, it, vi } from 'vitest';

const DISPLAY = { x: 0, y: 0, width: 1920, height: 1080 };

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  clipboard: { readText: () => '' },
  net: {},
  protocol: {},
  screen: {
    getDisplayNearestPoint: () => ({ bounds: DISPLAY, scaleFactor: 1 }),
    getCursorScreenPoint: () => ({ x: 0, y: 0 }),
  },
}));
vi.mock('node-screenshots', () => ({ Monitor: class {} }));
vi.mock('../capture/native', () => ({ loadNative: () => null }));

import type { ScreenElement } from '../capture/element';
import type { KeyAction } from '../capture/input-hook';
import {
  clickAction,
  frameFor,
  isBoundShortcut,
  isRepeatClick,
  isRepeatKey,
  isTextKey,
  shouldCapture,
  typedTextFor,
} from '../capture/recorder';
import {
  DEFAULT_CAPTURE_SETTINGS,
  MAX_TYPING_DEBOUNCE_MS,
  MIN_TYPING_DEBOUNCE_MS,
  normaliseSettings,
} from '../capture/settings';

const region = { x: 100, y: 100, width: 800, height: 600 };
const AREA = { ...DEFAULT_CAPTURE_SETTINGS, captureMode: 'area' as const };
const inside = { x: region.x + 10, y: region.y + 10 };
const outside = { x: region.x + region.width + 40, y: region.y + 20 };

function key(keycode: number, held: Partial<KeyAction> = {}): KeyAction {
  return { kind: 'keydown', keycode, shift: false, alt: false, ctrl: false, meta: false, at: 0, ...held };
}

function editor(value: string | null): ScreenElement {
  return {
    role: 'document',
    name: null,
    textContent: value,
    ariaLabel: 'Document',
    altText: null,
    password: false,
    ancestors: [],
    children: [],
    rect: { x: 0, y: 0, width: 400, height: 300 },
  };
}

describe('capture settings', () => {
  it('reads settings saved under the old names, letting a new name win and region mode read as area', () => {
    const legacy = normaliseSettings({ captureOutsideClicks: true, captureKeys: false, captureTyping: false });
    expect(legacy.keepClicksBeyondArea).toBe(true);
    expect(legacy.recordKeys).toBe(false);
    expect(legacy.recordTyping).toBe(false);
    expect(normaliseSettings({ recordTyping: true, captureTyping: false }).recordTyping).toBe(true);
    expect(normaliseSettings({ captureMode: 'region' as never }).captureMode).toBe('area');
  });

  it('clamps the knobs, drops a blank shortcut and keeps a missing one at its default', () => {
    const knobs = normaliseSettings({
      screenshotDelayMs: 5000,
      typingDebounceMs: 50,
      recordKeys: 'yes' as never,
      captureMode: 'sideways' as never,
      shortcuts: { record: '  ', pause: null, capture: 'Alt+F2' } as never,
    });
    expect(knobs.screenshotDelayMs).toBe(2000);
    expect(knobs.typingDebounceMs).toBe(MIN_TYPING_DEBOUNCE_MS);
    expect(normaliseSettings({ typingDebounceMs: 90_000 }).typingDebounceMs).toBe(MAX_TYPING_DEBOUNCE_MS);
    expect(knobs.recordKeys).toBe(DEFAULT_CAPTURE_SETTINGS.recordKeys);
    expect(knobs.captureMode).toBe(DEFAULT_CAPTURE_SETTINGS.captureMode);
    expect(knobs.shortcuts).toEqual({ record: null, pause: null, capture: 'Alt+F2' });
    expect(normaliseSettings({}).shortcuts.record).toBe(DEFAULT_CAPTURE_SETTINGS.shortcuts.record);
  });

  it('keeps the shortcuts saved under their earlier names', () => {
    const saved = normaliseSettings({
      shortcuts: { startStop: 'Ctrl+Alt+R', pauseResume: null, capture: 'Alt+F2' } as never,
    });
    expect(saved.shortcuts).toEqual({ record: 'Ctrl+Alt+R', pause: null, capture: 'Alt+F2' });
  });
});

describe('clicks', () => {
  it('reads the right button as its own action', () => {
    expect([clickAction(1), clickAction(2), clickAction(3)]).toEqual(['click', 'auxclick', 'click']);
  });

  it('keeps clicks outside the area only when asked, and never filters outside area mode', () => {
    expect(shouldCapture({ ...AREA, keepClicksBeyondArea: false }, region, outside)).toBe(false);
    expect(shouldCapture({ ...AREA, keepClicksBeyondArea: true }, region, outside)).toBe(true);
    expect(shouldCapture({ ...AREA, keepClicksBeyondArea: false }, region, inside)).toBe(true);
    expect(shouldCapture({ ...DEFAULT_CAPTURE_SETTINGS, keepClicksBeyondArea: false }, region, outside)).toBe(true);
  });

  it('treats a second press on the same spot within 500 ms as the same click', () => {
    const at = (time: number, x = 100, y = 100) => ({ at: time, point: { x, y } });
    expect(isRepeatClick(at(1_000), at(1_120))).toBe(true);
    expect(isRepeatClick(at(1_000), at(1_500, 103, 102))).toBe(true);
    expect(isRepeatClick(at(1_000), at(1_501))).toBe(false);
    expect(isRepeatClick(null, at(1_000))).toBe(false);
  });

  it('keeps a quick click on a different button as its own step', () => {
    expect(isRepeatClick({ at: 1_000, point: { x: 100, y: 100 } }, { at: 1_150, point: { x: 180, y: 100 } })).toBe(
      false,
    );
  });

  it('frames the display, the window under the click, or the area', () => {
    const window = { x: region.x + 5, y: region.y + 5, width: 300, height: 200 };
    const elsewhere = { x: 1500, y: 900, width: 100, height: 100 };
    expect(frameFor('screen', inside, region, window)).toEqual(DISPLAY);
    expect(frameFor('window', inside, region, window)).toEqual(window);
    expect(frameFor('window', inside, region, elsewhere)).toEqual(DISPLAY);
    expect(frameFor('window', inside, region, null)).toEqual(DISPLAY);
    expect(frameFor('area', outside, region, window)).toEqual(region);
  });
});

describe('keys', () => {
  it('opens a typing session only for keys that type', () => {
    expect(isTextKey(key(30))).toBe(true);
    expect(isTextKey(key(30, { shift: true }))).toBe(true);
    for (const closing of [key(30, { ctrl: true }), key(28), key(15), key(1), key(42)]) {
      expect(isTextKey(closing)).toBe(false);
    }
  });

  it('recognises our own hotkey whatever order it is written in, and nothing near it', () => {
    const pressed = key(31, { alt: true, shift: true });
    expect(isBoundShortcut('Alt+Shift+S', pressed, 'S')).toBe(true);
    expect(isBoundShortcut('shift+ALT+s', pressed, 'S')).toBe(true);
    expect(isBoundShortcut('Alt+Shift+S', key(31, { alt: true }), 'S')).toBe(false);
    expect(isBoundShortcut('Alt+Shift+S', key(31, { alt: true, shift: true, ctrl: true }), 'S')).toBe(false);
    expect(isBoundShortcut('Alt+Shift+S', pressed, 'R')).toBe(false);
    expect(isBoundShortcut(null, pressed, 'S')).toBe(false);
  });

  it('names a shortcut the way each platform writes it, and collapses auto-repeat', () => {
    expect(keyCombo(key(31, { ctrl: true, shift: true }), 'S', false)).toBe('Ctrl+Shift+S');
    expect(keyCombo(key(31, { meta: true, shift: true, alt: true }), 'S', true)).toBe('⌥⇧⌘S');
    expect(isRepeatKey({ keycode: 28, at: 1_000 }, 28, 1_400)).toBe(true);
    expect(isRepeatKey({ keycode: 28, at: 1_000 }, 28, 1_600)).toBe(false);
    expect(isRepeatKey({ keycode: 28, at: 1_000 }, 15, 1_100)).toBe(false);
  });
});

describe('typed text', () => {
  it("reads the field's text, and falls back to the keystrokes for long or multi-line fields", () => {
    expect(typedTextFor(editor('a short note'), 'a sho', false)).toBe('a sho');
    expect(typedTextFor(editor('a short note'), 'a sho')).toBe('a short note');
    expect(typedTextFor(editor(null), 'typed')).toBe('typed');
    expect(typedTextFor({ ...editor('﻿hi​'), role: 'textbox' }, '')).toBe('hi');
    expect(typedTextFor({ ...editor('Save'), role: 'button' }, 'typed')).toBeNull();
    expect(typedTextFor(editor('x'.repeat(201)), 'ab')).toBe('ab');
    expect(typedTextFor(editor('y'.repeat(200)), 'ab')).toBe('y'.repeat(200));
    expect(typedTextFor(editor('Last login\n➜  ~ testing'), 'testing')).toBe('testing');
    expect(typedTextFor(editor('line one\nline two'), '')).toBe('line one\nline two');
  });
});
