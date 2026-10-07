import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

export type CursorStyle = 'arrow' | 'hand' | 'dot';
export type CaptureMode = 'window' | 'screen' | 'region';

export const CURSOR_STYLES: CursorStyle[] = ['arrow', 'hand', 'dot'];
export const CAPTURE_MODES: CaptureMode[] = ['window', 'screen', 'region'];
export const MAX_SCREENSHOT_DELAY_MS = 2000;

export interface CaptureSettings {
  captureMode: CaptureMode;
  showCursor: boolean;
  cursorStyle: CursorStyle;
  screenshotDelayMs: number;
  captureOutsideClicks: boolean;
}

export const DEFAULT_CAPTURE_SETTINGS: CaptureSettings = {
  captureMode: 'window',
  showCursor: true,
  cursorStyle: process.platform === 'darwin' ? 'arrow' : process.platform === 'win32' ? 'arrow' : 'dot',
  screenshotDelayMs: 0,
  captureOutsideClicks: false,
};

function file(): string {
  return join(app.getPath('userData'), 'capture-settings.json');
}

export function normaliseSettings(input: Partial<CaptureSettings>): CaptureSettings {
  const delay = Number(input.screenshotDelayMs);
  return {
    captureMode: CAPTURE_MODES.includes(input.captureMode as CaptureMode)
      ? (input.captureMode as CaptureMode)
      : DEFAULT_CAPTURE_SETTINGS.captureMode,
    showCursor: typeof input.showCursor === 'boolean' ? input.showCursor : DEFAULT_CAPTURE_SETTINGS.showCursor,
    cursorStyle: CURSOR_STYLES.includes(input.cursorStyle as CursorStyle)
      ? (input.cursorStyle as CursorStyle)
      : DEFAULT_CAPTURE_SETTINGS.cursorStyle,
    screenshotDelayMs: Number.isFinite(delay) ? Math.min(Math.max(Math.round(delay), 0), MAX_SCREENSHOT_DELAY_MS) : 0,
    captureOutsideClicks:
      typeof input.captureOutsideClicks === 'boolean'
        ? input.captureOutsideClicks
        : DEFAULT_CAPTURE_SETTINGS.captureOutsideClicks,
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
