const PRESETS = [1, 1.5, 2, 3, 4, 5];

export function zoomLevels(current: number | null): (number | null)[] {
  const levels = current === null || PRESETS.includes(current) ? PRESETS : [...PRESETS, current].sort((a, b) => a - b);
  return [null, ...levels];
}
