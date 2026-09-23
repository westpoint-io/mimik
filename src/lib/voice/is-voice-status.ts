import type { VoiceStatusResponse } from './voice-message';

export function isVoiceStatus(value: unknown): value is VoiceStatusResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<VoiceStatusResponse>;
  return typeof candidate.recording === 'boolean' && typeof candidate.transcribing === 'boolean';
}
