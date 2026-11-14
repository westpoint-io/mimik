import type { VoiceProvider } from './transcribe';

export function canTranscribe(settings: { provider: VoiceProvider; apiKey: string; baseUrl?: string }): boolean {
  return settings.provider === 'server' ? Boolean(settings.baseUrl) : settings.apiKey.length > 0;
}
