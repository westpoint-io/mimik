const MAC_SYMBOLS: Record<string, string> = {
  control: '⌃',
  ctrl: '⌃',
  alt: '⌥',
  altgr: '⌥',
  option: '⌥',
  shift: '⇧',
  command: '⌘',
  cmd: '⌘',
  commandorcontrol: '⌘',
  cmdorctrl: '⌘',
  super: '⌘',
  meta: '⌘',
};
const MAC_ORDER = ['⌃', '⌥', '⇧', '⌘'];

export function shortcutLabel(accelerator: string, mac: boolean): string {
  const parts = accelerator
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  const key = parts.pop() ?? '';
  if (!mac)
    return [...parts.map((part) => (/^(commandorcontrol|cmdorctrl)$/i.test(part) ? 'Ctrl' : part)), key].join('+');
  const held = new Set(parts.map((part) => MAC_SYMBOLS[part.toLowerCase()] ?? part));
  return [...MAC_ORDER.filter((symbol) => held.has(symbol)), key].join('');
}
