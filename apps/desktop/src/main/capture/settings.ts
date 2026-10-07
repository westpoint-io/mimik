import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CursorStyle } from '@mimik/core/screenshot/types';
import { app } from 'electron';

export type { CursorStyle };
export type CaptureMode = 'window' | 'screen' | 'region';

const EVERY_CURSOR_STYLE: Record<CursorStyle, true> = { arrow: true, hand: true, dot: true };
export const CURSOR_STYLES = Object.keys(EVERY_CURSOR_STYLE) as CursorStyle[];
export const CAPTURE_MODES: CaptureMode[] = ['window', 'screen', 'region'];
export const MAX_SCREENSHOT_DELAY_MS = 2000;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;
export const MIN_TYPING_DEBOUNCE_MS = 200;
export const MAX_TYPING_DEBOUNCE_MS = 5000;

export interface CaptureShortcuts {
  startStop: string | null;
  pauseResume: string | null;
  capture: string | null;
}

export interface CaptureSettings {
  captureMode: CaptureMode;
  showCursor: boolean;
  cursorStyle: CursorStyle;
  screenshotDelayMs: number;
  keepClicksBeyondArea: boolean;
  recordKeys: boolean;
  recordTyping: boolean;
  typingDebounceMs: number;
  readFieldText: boolean;
  zoomLevel: number | null;
  shortcuts: CaptureShortcuts;
}

export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  captureMode: 'window',
  showCursor: true,
  cursorStyle: process.platform === 'darwin' ? 'arrow' : process.platform === 'win32' ? 'arrow' : 'dot',
  screenshotDelayMs: 0,
  keepClicksBeyondArea: false,
  recordKeys: true,
  recordTyping: true,
  typingDebounceMs: 1200,
  readFieldText: true,
  zoomLevel: null,
  shortcuts: {
    startStop: 'Alt+Shift+R',
    pauseResume: 'Alt+Shift+P',
    capture: 'Alt+Shift+C',
  },
};

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function accelerator(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function shortcuts(input: Partial<CaptureShortcuts> | undefined): CaptureShortcuts {
  const given = input ?? {};
  const fallback = DEFAULT_CAPTURE_SETTINGS.shortcuts;
  return {
    startStop: accelerator(given.startStop, fallback.startStop),
    pauseResume: accelerator(given.pauseResume, fallback.pauseResume),
    capture: accelerator(given.capture, fallback.capture),
  };
}

function file(): string {
  return join(app.getPath('userData'), 'capture-settings.json');
}

function snapZoom(zoom: number): number {
  return Math.min(Math.max(Math.round(zoom / ZOOM_STEP) * ZOOM_STEP, MIN_ZOOM), MAX_ZOOM);
}

type LegacySettings = Partial<
  Record<'captureOutsideClicks' | 'captureKeys' | 'captureTyping' | 'typingSmartDetection', unknown>
>;

export function normaliseSettings(input: Partial<CaptureSettings> & LegacySettings): CaptureSettings {
  const delay = Number(input.screenshotDelayMs);
  const debounce = input.typingDebounceMs === undefined ? Number.NaN : Number(input.typingDebounceMs);
  return {
    captureMode: CAPTURE_MODES.includes(input.captureMode as CaptureMode)
      ? (input.captureMode as CaptureMode)
      : DEFAULT_CAPTURE_SETTINGS.captureMode,
    showCursor: typeof input.showCursor === 'boolean' ? input.showCursor : DEFAULT_CAPTURE_SETTINGS.showCursor,
    cursorStyle: CURSOR_STYLES.includes(input.cursorStyle as CursorStyle)
      ? (input.cursorStyle as CursorStyle)
      : DEFAULT_CAPTURE_SETTINGS.cursorStyle,
    screenshotDelayMs: Number.isFinite(delay) ? Math.min(Math.max(Math.round(delay), 0), MAX_SCREENSHOT_DELAY_MS) : 0,
    keepClicksBeyondArea: flag(
      input.keepClicksBeyondArea ?? input.captureOutsideClicks,
      DEFAULT_CAPTURE_SETTINGS.keepClicksBeyondArea,
    ),
    recordKeys: flag(input.recordKeys ?? input.captureKeys, DEFAULT_CAPTURE_SETTINGS.recordKeys),
    recordTyping: flag(input.recordTyping ?? input.captureTyping, DEFAULT_CAPTURE_SETTINGS.recordTyping),
    typingDebounceMs: Number.isFinite(debounce)
      ? Math.min(Math.max(Math.round(debounce), MIN_TYPING_DEBOUNCE_MS), MAX_TYPING_DEBOUNCE_MS)
      : DEFAULT_CAPTURE_SETTINGS.typingDebounceMs,
    readFieldText: flag(input.readFieldText ?? input.typingSmartDetection, DEFAULT_CAPTURE_SETTINGS.readFieldText),
    zoomLevel: Number.isFinite(Number(input.zoomLevel)) ? snapZoom(Number(input.zoomLevel)) : null,
    shortcuts: shortcuts(input.shortcuts),
  };
}

export function loadSettings(): CaptureSettings {
  try {
    return normaliseSettings(JSON.parse(readFileSync(file(), 'utf8')) as Partial<CaptureSettings>);
  } catch {
    return { ...DEFAULT_CAPTURE_SETTINGS };
  }
}

export function saveSettings(input: Partial<CaptureSettings>): CaptureSettings {
  const settings = normaliseSettings({ ...loadSettings(), ...input });
  try {
    writeFileSync(file(), JSON.stringify(settings));
  } catch {}
  return settings;
}
