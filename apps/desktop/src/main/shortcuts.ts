import { globalShortcut } from 'electron';
import type { CaptureShortcuts } from './capture/settings';

export type ShortcutName = keyof CaptureShortcuts;

export function shortcutMap(shortcuts: CaptureShortcuts, recording: boolean): Record<ShortcutName, string | null> {
  return {
    startStop: shortcuts.startStop,
    pauseResume: recording ? shortcuts.pauseResume : null,
    capture: recording ? shortcuts.capture : null,
  };
}

let bound: string[] = [];
let current: Record<ShortcutName, string | null> | null = null;

export function sameShortcuts(
  a: Record<ShortcutName, string | null> | null,
  b: Record<ShortcutName, string | null>,
): boolean {
  return a !== null && a.startStop === b.startStop && a.pauseResume === b.pauseResume && a.capture === b.capture;
}

export function unbindShortcuts(): void {
  for (const accelerator of bound) {
    try {
      globalShortcut.unregister(accelerator);
    } catch {}
  }
  bound = [];
  current = null;
}

export function bindShortcuts(
  wanted: Record<ShortcutName, string | null>,
  run: (name: ShortcutName) => void,
): string[] {
  if (sameShortcuts(current, wanted)) return [];
  unbindShortcuts();
  const refused: string[] = [];
  for (const [name, accelerator] of Object.entries(wanted) as [ShortcutName, string | null][]) {
    if (!accelerator) continue;
    try {
      if (globalShortcut.register(accelerator, () => run(name))) bound.push(accelerator);
      else refused.push(accelerator);
    } catch {
      refused.push(accelerator);
    }
  }
  current = { ...wanted };
  return refused;
}
