import {
  AI_CREDENTIAL_SETTINGS,
  type AiSettingsStored,
  readApiKeys,
  requestHeaders,
  resolveServer,
} from '@/core/capture/ai/keys';
import { normalizeBaseUrl } from '@/core/capture/ai/models';
import { modelForProvider, type VoiceoverProviderKey, voiceForProvider, voiceoverProviderOrDefault } from './providers';

export type VoiceoverApiKeys = Partial<Record<VoiceoverProviderKey, string>>;

export const VOICEOVER_SETTINGS = [
  'voiceoverProvider',
  'voiceoverVoiceId',
  'voiceoverModelId',
  ...AI_CREDENTIAL_SETTINGS,
] as const;

export interface VoiceoverSettings extends AiSettingsStored {
  voiceoverProvider?: unknown;
  voiceoverVoiceId?: unknown;
  voiceoverModelId?: unknown;
}

export interface VoiceoverConfig {
  provider: VoiceoverProviderKey;
  apiKey: string;
  voiceId: string;
  modelId: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function credentials(
  provider: VoiceoverProviderKey,
  stored: VoiceoverSettings,
): Pick<VoiceoverConfig, 'apiKey' | 'baseUrl' | 'headers'> {
  if (provider !== 'server') return { apiKey: readApiKeys(stored)[provider] ?? '' };
  const server = resolveServer(stored);
  if (server?.protocol !== 'openai') return { apiKey: '' };
  const headers = requestHeaders(server.headers);
  return {
    apiKey: server.apiKey,
    baseUrl: normalizeBaseUrl(server.url),
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
  };
}

export function resolveVoiceoverConfig(stored: VoiceoverSettings): VoiceoverConfig {
  const provider = voiceoverProviderOrDefault(stored.voiceoverProvider);
  return {
    provider,
    ...credentials(provider, stored),
    voiceId: voiceForProvider(provider, trimmed(stored.voiceoverVoiceId)),
    modelId: modelForProvider(provider, trimmed(stored.voiceoverModelId)),
  };
}

export function canVoiceover(config: VoiceoverConfig): boolean {
  return config.provider === 'server' ? Boolean(config.baseUrl) : config.apiKey.length > 0;
}

export function hasVoiceoverKey(stored: VoiceoverSettings): boolean {
  return canVoiceover(resolveVoiceoverConfig(stored));
}
