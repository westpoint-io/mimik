import type { VoiceProvider } from './transcribe';

export const VOICE_KEY_SETTINGS = [
  'voiceProvider',
  'voiceApiKey',
  'voiceBaseUrl',
  'voiceModel',
  'aiProvider',
  'aiApiKey',
] as const;

export interface VoiceKeySettings {
  voiceProvider?: unknown;
  voiceApiKey?: unknown;
  voiceBaseUrl?: unknown;
  voiceModel?: unknown;
  aiProvider?: unknown;
  aiApiKey?: unknown;
}

export type VoiceApiKeySource = 'voice' | 'ai' | 'none';

export interface ResolvedVoiceApiKey {
  provider: VoiceProvider;
  apiKey: string;
  source: VoiceApiKeySource;
  baseURL?: string;
  model?: string;
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeVoiceProvider(value: unknown): VoiceProvider {
  if (value === 'groq') return 'groq';
  if (value === 'azure') return 'azure';
  return 'openai';
}

export function resolveVoiceApiKey(settings: VoiceKeySettings): ResolvedVoiceApiKey {
  const provider = normalizeVoiceProvider(settings.voiceProvider);
  const own = trimmed(settings.voiceApiKey);

  if (provider === 'azure') {
    const baseURL = trimmed(settings.voiceBaseUrl);
    const model = trimmed(settings.voiceModel);
    if (!own || !baseURL || !model) return { provider, apiKey: '', source: 'none' };
    return { provider, apiKey: own, source: 'voice', baseURL, model };
  }

  if (own) return { provider, apiKey: own, source: 'voice' };

  const shared = trimmed(settings.aiApiKey);
  const aiProvider = trimmed(settings.aiProvider) || 'openai';
  if (provider !== 'openai' || aiProvider !== 'openai' || !shared) {
    return { provider, apiKey: '', source: 'none' };
  }

  return { provider, apiKey: shared, source: 'ai' };
}

export function hasVoiceApiKey(settings: VoiceKeySettings): boolean {
  return resolveVoiceApiKey(settings).apiKey.length > 0;
}
