import { localStorage } from '@/core/env';
import { resolveVoiceApiKey, VOICE_KEY_SETTINGS } from './api-key';
import type { VoiceProvider } from './transcribe';

export interface TranscriptionSettings {
  provider: VoiceProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  language?: string;
}

export async function readTranscriptionSettings(): Promise<TranscriptionSettings> {
  const stored = await localStorage.get([...VOICE_KEY_SETTINGS, 'voiceServerModel', 'voiceLanguage', 'aiLanguage']);
  const { provider, apiKey, baseUrl } = resolveVoiceApiKey(stored);
  const locale = (stored.voiceLanguage ?? stored.aiLanguage) as string | undefined;
  const model = typeof stored.voiceServerModel === 'string' ? stored.voiceServerModel.trim() : '';
  return {
    provider,
    apiKey,
    ...(baseUrl ? { baseUrl, model: model || undefined } : {}),
    language: locale ? locale.split('-')[0] : undefined,
  };
}
