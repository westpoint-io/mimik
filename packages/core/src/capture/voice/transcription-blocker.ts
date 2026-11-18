import { canTranscribe } from './can-transcribe';
import type { VoiceProvider } from './transcribe';

export type TranscriptionBlocker = 'missing-api-key' | 'server-not-ready';

export function transcriptionBlocker(
  settings: { provider: VoiceProvider; apiKey: string; baseUrl?: string } | undefined,
): TranscriptionBlocker | null {
  if (settings && canTranscribe(settings)) return null;
  return settings?.provider === 'server' ? 'server-not-ready' : 'missing-api-key';
}
