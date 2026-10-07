const LEVEL_FLOOR_DB = -60;

const SPEAKING_FLOOR_DB = -45;

export const SPEAKING_LEVEL = (SPEAKING_FLOOR_DB - LEVEL_FLOOR_DB) / -LEVEL_FLOOR_DB;

const LEVEL_SMOOTHING = 0.6;

export function nextMicLevel(rms: number, previous: number): number {
  const db = rms > 0 ? 20 * Math.log10(rms) : LEVEL_FLOOR_DB;
  const normalised = Math.min(1, Math.max(0, (db - LEVEL_FLOOR_DB) / -LEVEL_FLOOR_DB));
  return previous * LEVEL_SMOOTHING + normalised * (1 - LEVEL_SMOOTHING);
}
