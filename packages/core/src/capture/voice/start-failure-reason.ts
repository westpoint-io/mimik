import type { VoiceErrorReason } from './voice-update';

export function startFailureReason(error: unknown): VoiceErrorReason {
  if (!(error instanceof Error)) return 'unknown';
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'permission-denied';
  if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'no-device';
  if (error.name === 'NotSupportedError') return 'unsupported';
  return 'unknown';
}
