export type SettingsSnapshot = Record<string, unknown>;

export function changedSettings(next: SettingsSnapshot, previous: SettingsSnapshot): SettingsSnapshot | null {
  const patch: SettingsSnapshot = {};
  for (const [key, value] of Object.entries(next)) {
    if (Object.is(value, previous[key])) continue;
    if (JSON.stringify(value) === JSON.stringify(previous[key])) continue;
    patch[key] = value;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
