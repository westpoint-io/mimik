import type { MicActivity } from './mic-activity';

const MIC_ACTIVITY_KEYS: Record<MicActivity, string> = {
  waiting: 'voice.micStarting',
  speaking: 'voice.micHearing',
  quiet: 'voice.micQuiet',
};

export function micActivityKey(activity: MicActivity): string {
  return MIC_ACTIVITY_KEYS[activity];
}
