import { type VoiceEnvelope, VoiceMessage, type VoiceTarget } from './voice-message';

export function isVoiceMessageFor(target: VoiceTarget, message: unknown): message is VoiceEnvelope {
  if (typeof message !== 'object' || message === null) return false;
  const candidate = message as Partial<VoiceEnvelope>;
  return (
    candidate.target === target && typeof candidate.type === 'string' && Object.hasOwn(VoiceMessage, candidate.type)
  );
}
