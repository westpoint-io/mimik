export type VoicePhase = 'idle' | 'recording' | 'transcribing' | 'error';

export type VoiceErrorReason =
  | 'permission-denied'
  | 'no-device'
  | 'no-audio'
  | 'not-recording'
  | 'already-recording'
  | 'missing-api-key'
  | 'stream-ended'
  | 'unsupported'
  | 'unknown';

export interface VoiceUpdate {
  phase: VoicePhase;
  reason?: VoiceErrorReason;
  error?: string;
  narrated?: number;
}
