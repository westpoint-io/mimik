export type VoiceStopAction = 'stop-host' | 'recover' | 'report-lost' | 'skip';

export function voiceStopAction(input: {
  hostAlive: boolean;
  hasOrphanAudio: boolean;
  wasRecording: boolean;
}): VoiceStopAction {
  if (input.hasOrphanAudio) return 'recover';
  if (input.hostAlive) return 'stop-host';
  return input.wasRecording ? 'report-lost' : 'skip';
}
