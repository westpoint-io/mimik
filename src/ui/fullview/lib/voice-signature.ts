import type { PanelVoiceUpdate } from '@/lib/port/types';

export function voiceSignature(update: PanelVoiceUpdate): string {
  return `${update.phase}:${update.reason ?? ''}:${update.narrated ?? ''}`;
}
