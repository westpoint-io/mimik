import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, desktopCapturer, shell, systemPreferences } from 'electron';

export interface CapturePermissions {
  accessibility: boolean;
  screen: boolean;
}

export type PermissionKind = keyof CapturePermissions;

const SETTINGS_PANE: Record<PermissionKind, string> = {
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
};

const MICROPHONE_PANE = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone';

const PROMPTED_FILE = 'permission-prompts.json';
const HELD_FILE = 'held-capture.json';
const HELD_FOR_MS = 10 * 60 * 1000;

export function readPermissions(): CapturePermissions {
  if (process.platform !== 'darwin') return { accessibility: true, screen: true };
  return {
    accessibility: systemPreferences.isTrustedAccessibilityClient(false),
    screen: systemPreferences.getMediaAccessStatus('screen') === 'granted',
  };
}

export function holdCapture(held: boolean): void {
  const file = join(app.getPath('userData'), HELD_FILE);
  if (held) writeFileSync(file, JSON.stringify({ at: Date.now() }));
  else rmSync(file, { force: true });
}

export function captureWasHeld(): boolean {
  try {
    const { at } = JSON.parse(readFileSync(join(app.getPath('userData'), HELD_FILE), 'utf8'));
    return Date.now() - at < HELD_FOR_MS;
  } catch {
    return false;
  }
}

function prompted(): PermissionKind[] {
  try {
    return JSON.parse(readFileSync(join(app.getPath('userData'), PROMPTED_FILE), 'utf8'));
  } catch {
    return [];
  }
}

export async function requestPermission(kind: PermissionKind): Promise<void> {
  if (process.platform !== 'darwin') return;
  const asked = prompted();
  if (asked.includes(kind)) {
    await shell.openExternal(SETTINGS_PANE[kind]);
    return;
  }
  writeFileSync(join(app.getPath('userData'), PROMPTED_FILE), JSON.stringify([...asked, kind]));
  if (kind === 'accessibility') systemPreferences.isTrustedAccessibilityClient(true);
  else await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } }).catch(() => []);
}

export type MicrophoneAccess = 'granted' | 'ask' | 'denied';

export function microphoneAccess(): MicrophoneAccess {
  if (process.platform !== 'darwin') return 'granted';
  const status = systemPreferences.getMediaAccessStatus('microphone');
  return status === 'granted' ? 'granted' : status === 'not-determined' ? 'ask' : 'denied';
}

export async function askMicrophone(): Promise<boolean> {
  const access = microphoneAccess();
  if (access === 'granted') return true;
  if (access === 'ask') return systemPreferences.askForMediaAccess('microphone');
  await shell.openExternal(MICROPHONE_PANE);
  return false;
}
