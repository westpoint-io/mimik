import { API_KEY_SETTINGS, type ApiKeySettings, readApiKeys } from '@/core/capture/ai/keys';
import { modelForProvider, type VoiceoverProviderKey, voiceForProvider, voiceoverProviderOrDefault } from './providers';

export type VoiceoverApiKeys = Partial<Record<VoiceoverProviderKey, string>>;

export const VOICEOVER_SETTINGS = [
  'voiceoverProvider',
  'voiceoverVoiceId',
  'voiceoverModelId',
  ...API_KEY_SETTINGS,
] as const;

export interface VoiceoverSettings extends ApiKeySettings {
  voiceoverProvider?: unknown;
  voiceoverVoiceId?: unknown;
  voiceoverModelId?: unknown;
}

export interface VoiceoverConfig {
  provider: VoiceoverProviderKey;
  apiKey: string;
  voiceId: string;
  modelId: string;
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveVoiceoverConfig(stored: VoiceoverSettings): VoiceoverConfig {
  const provider = voiceoverProviderOrDefault(stored.voiceoverProvider);
  return {
    provider,
    apiKey: readApiKeys(stored)[provider] ?? '',
    voiceId: voiceForProvider(provider, trimmed(stored.voiceoverVoiceId)),
    modelId: modelForProvider(provider, trimmed(stored.voiceoverModelId)),
  };
}

export function hasVoiceoverKey(stored: VoiceoverSettings): boolean {
  return resolveVoiceoverConfig(stored).apiKey.length > 0;
}
