import { API_KEY_SETTINGS, type ApiKeySettings, readApiKeys } from '@/core/capture/ai/keys';
import type { VoiceProvider } from './transcribe';

export const VOICE_KEY_SETTINGS = API_KEY_SETTINGS;

export type VoiceKeySettings = ApiKeySettings;

export interface ResolvedVoiceApiKey {
  provider: VoiceProvider;
  apiKey: string;
}

export function normalizeVoiceProvider(value: unknown): VoiceProvider {
  return value === 'groq' ? 'groq' : 'openai';
}

export function resolveVoiceApiKey(settings: VoiceKeySettings): ResolvedVoiceApiKey {
  const provider = normalizeVoiceProvider(settings.voiceProvider);
  return { provider, apiKey: readApiKeys(settings)[provider] ?? '' };
}

export function hasVoiceApiKey(settings: VoiceKeySettings): boolean {
  return resolveVoiceApiKey(settings).apiKey.length > 0;
}
