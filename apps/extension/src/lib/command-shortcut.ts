const KEY = /^(Key[A-Z]|Digit\d|F\d{1,2})$/;

export function commandShortcut(event: KeyboardEvent, mac: boolean): string | null {
  if (!KEY.test(event.code)) return null;
  const held: string[] = [];
  if (event.ctrlKey) held.push(mac ? 'MacCtrl' : 'Ctrl');
  if (event.metaKey && mac) held.push('Command');
  if (event.altKey) held.push('Alt');
  if (event.shiftKey) held.push('Shift');
  if (held.length === 0 || (held.length === 1 && held[0] === 'Shift')) return null;
  return [...held, event.code.replace(/^(Key|Digit)/, '')].join('+');
}
