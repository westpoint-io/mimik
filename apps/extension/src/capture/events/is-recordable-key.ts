const NOT_STEPS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'AltGraph',
  'CapsLock',
  'Dead',
  'Unidentified',
  'Process',
]);

export function isRecordableKey(key: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean {
  if (NOT_STEPS.has(key.key)) return false;
  return key.ctrlKey || key.metaKey || key.altKey || key.key.length > 1;
}
