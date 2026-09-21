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

export function unbindShortcuts(): void {
  for (const accelerator of bound) {
    try {
      globalShortcut.unregister(accelerator);
    } catch {}
  }
  bound = [];
}

export function bindShortcuts(
  wanted: Record<ShortcutName, string | null>,
  run: (name: ShortcutName) => void,
): string[] {
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
  return refused;
}
