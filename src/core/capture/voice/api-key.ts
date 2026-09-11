import { resolveAiKey } from '@/core/capture/ai/keys';
import type { VoiceProvider } from './transcribe';

export const VOICE_KEY_SETTINGS = ['voiceProvider', 'voiceApiKey', 'aiProvider', 'aiApiKey', 'aiApiKeys'] as const;

export interface VoiceKeySettings {
  voiceProvider?: unknown;
  voiceApiKey?: unknown;
  aiProvider?: unknown;
  aiApiKey?: unknown;
  aiApiKeys?: unknown;
}

export type VoiceApiKeySource = 'voice' | 'ai' | 'none';

export interface ResolvedVoiceApiKey {
  provider: VoiceProvider;
  apiKey: string;
  source: VoiceApiKeySource;
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeVoiceProvider(value: unknown): VoiceProvider {
  return value === 'groq' ? 'groq' : 'openai';
}

export function resolveVoiceApiKey(settings: VoiceKeySettings): ResolvedVoiceApiKey {
  const provider = normalizeVoiceProvider(settings.voiceProvider);
  const own = trimmed(settings.voiceApiKey);
  if (own) return { provider, apiKey: own, source: 'voice' };

  const resolved = resolveAiKey(settings);
  const shared = resolved.apiKey;
  const aiProvider = resolved.provider;
  if (provider !== 'openai' || aiProvider !== 'openai' || !shared) {
    return { provider, apiKey: '', source: 'none' };
  }

  return { provider, apiKey: shared, source: 'ai' };
}

export function hasVoiceApiKey(settings: VoiceKeySettings): boolean {
  return resolveVoiceApiKey(settings).apiKey.length > 0;
}
