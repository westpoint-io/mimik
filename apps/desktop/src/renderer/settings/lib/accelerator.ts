const MODIFIERS = new Set(['Control', 'Alt', 'Shift', 'Meta']);

export function accelerator(event: React.KeyboardEvent): string | null {
  if (MODIFIERS.has(event.key)) return null;
  const held: string[] = [];
  if (event.metaKey) held.push('Super');
  if (event.ctrlKey) held.push('Control');
  if (event.altKey) held.push('Alt');
  if (event.shiftKey) held.push('Shift');
  if (held.length === 0) return null;
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  return [...held, key].join('+');
}
