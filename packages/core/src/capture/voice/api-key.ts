import {
  AI_CREDENTIAL_SETTINGS,
  type AiSettingsStored,
  readApiKeys,
  requestHeaders,
  resolveServer,
} from '@/core/capture/ai/keys';
import { canTranscribe } from './can-transcribe';
import type { VoiceProvider } from './transcribe';

export const VOICE_KEY_SETTINGS = AI_CREDENTIAL_SETTINGS;

export type VoiceKeySettings = AiSettingsStored;

export interface ResolvedVoiceApiKey {
  provider: VoiceProvider;
  apiKey: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

export function normalizeVoiceProvider(value: unknown): VoiceProvider {
  return value === 'groq' || value === 'server' ? value : 'openai';
}

export function resolveVoiceApiKey(settings: VoiceKeySettings): ResolvedVoiceApiKey {
  const provider = normalizeVoiceProvider(settings.voiceProvider);
  if (provider === 'server') {
    const server = resolveServer(settings);
    if (server?.protocol !== 'openai') return { provider, apiKey: '' };
    const headers = requestHeaders(server.headers);
    return {
      provider,
      apiKey: server.apiKey,
      baseUrl: server.url,
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    };
  }
  return { provider, apiKey: readApiKeys(settings)[provider] ?? '' };
}

export function hasVoiceApiKey(settings: VoiceKeySettings): boolean {
  return canTranscribe(resolveVoiceApiKey(settings));
}
