import { shortcutLabel } from './shortcut-label';

export interface HeldKeys {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export function keyCombo(held: HeldKeys, key: string, mac: boolean): string {
  const shown = key.length === 1 ? key.toUpperCase() : key;
  const parts = [
    ...(held.meta ? [mac ? 'Command' : 'Meta'] : []),
    ...(held.ctrl ? ['Ctrl'] : []),
    ...(held.alt ? ['Alt'] : []),
    ...(held.shift ? ['Shift'] : []),
    shown,
  ].join('+');
  return mac ? shortcutLabel(parts, true) : parts;
}
