export const SPEAKING_HOLD_MS = 1200;
export const LEVEL_STALE_MS = 1500;

export type MicActivity = 'waiting' | 'speaking' | 'quiet';

export const MIC_ACTIVITIES: MicActivity[] = ['waiting', 'speaking', 'quiet'];

export function micActivity(levelAt: number | null, speakingAt: number | null, now: number): MicActivity {
  if (levelAt === null) return 'waiting';
  if (speakingAt !== null && now - speakingAt <= SPEAKING_HOLD_MS) return 'speaking';
  return 'quiet';
}
