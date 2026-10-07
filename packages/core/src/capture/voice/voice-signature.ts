import type { VoiceUpdate } from './voice-update';

export function voiceSignature(update: VoiceUpdate): string {
  return `${update.phase}:${update.reason ?? ''}:${update.narrated ?? ''}`;
}
