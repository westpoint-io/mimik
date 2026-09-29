import {
  AI_PROVIDERS,
  type AIProtocol,
  type AIProviderKey,
  isCustomBaseUrl,
  isProviderKey,
  providerOrDefault,
} from './models';

export type AIApiKeys = Partial<Record<AIProviderKey, string>>;

export const KEY_PROVIDERS = ['openai', 'anthropic', 'deepseek', 'openrouter', 'groq', 'elevenlabs'] as const;

export type KeyProvider = (typeof KEY_PROVIDERS)[number];

export const KEY_PROVIDER_LABELS: Record<KeyProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  elevenlabs: 'ElevenLabs',
};

export const KEY_PLACEHOLDERS: Record<KeyProvider, string> = {
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
  deepseek: 'sk-...',
  openrouter: 'sk-or-...',
  groq: 'gsk_...',
  elevenlabs: 'sk_...',
};

export const SERVER = 'server';

export type KeyName = KeyProvider | typeof SERVER;

export type ApiKeys = Partial<Record<KeyName, string>>;

export type AiChoice = AIProviderKey | typeof SERVER;

export interface AiServer {
  url: string;
  protocol: AIProtocol;
  apiKey: string;
}

export interface ApiKeySettings {
  apiKeys?: unknown;
  aiApiKeys?: unknown;
  aiApiKey?: unknown;
  aiProvider?: unknown;
  voiceApiKey?: unknown;
  voiceProvider?: unknown;
  voiceoverApiKeys?: unknown;
}

export interface AiSettingsStored extends ApiKeySettings {
  aiModel?: unknown;
  aiBaseUrl?: unknown;
  aiServerUrl?: unknown;
  aiServerProtocol?: unknown;
}

export const API_KEY_SETTINGS = [
  'apiKeys',
  'aiApiKeys',
  'aiApiKey',
  'aiProvider',
  'voiceApiKey',
  'voiceProvider',
  'voiceoverApiKeys',
] as const;

export const AI_CREDENTIAL_SETTINGS = [
  ...API_KEY_SETTINGS,
  'aiModel',
  'aiBaseUrl',
  'aiServerUrl',
  'aiServerProtocol',
] as const;

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isKeyName(name: string): name is KeyName {
  return name === SERVER || (KEY_PROVIDERS as readonly string[]).includes(name);
}

export function parseApiKeys(value: unknown): AIApiKeys {
  if (typeof value !== 'object' || value === null) return {};
  const keys: AIApiKeys = {};
  for (const [provider, key] of Object.entries(value as Record<string, unknown>)) {
    if (!isProviderKey(provider)) continue;
    const trimmedKey = trimmed(key);
    if (trimmedKey) keys[provider] = trimmedKey;
  }
  return keys;
}

export function migrateApiKeys(stored: { aiApiKeys?: unknown; aiApiKey?: unknown; aiProvider?: unknown }): AIApiKeys {
  const keys = parseApiKeys(stored.aiApiKeys);
  if (Object.keys(keys).length > 0) return keys;

  const legacy = trimmed(stored.aiApiKey);
  return legacy ? { [providerOrDefault(stored.aiProvider)]: legacy } : {};
}

function parseKeys(value: unknown): ApiKeys {
  if (typeof value !== 'object' || value === null) return {};
  const keys: ApiKeys = {};
  for (const [name, key] of Object.entries(value as Record<string, unknown>)) {
    const trimmedKey = trimmed(key);
    if (isKeyName(name) && trimmedKey) keys[name] = trimmedKey;
  }
  return keys;
}

export function readApiKeys(stored: ApiKeySettings): ApiKeys {
  if (typeof stored.apiKeys === 'object' && stored.apiKeys !== null) return parseKeys(stored.apiKeys);
  const voice = trimmed(stored.voiceApiKey);
  return {
    ...parseKeys(stored.voiceoverApiKeys),
    ...(voice ? { [stored.voiceProvider === 'groq' ? 'groq' : 'openai']: voice } : {}),
    ...migrateApiKeys(stored),
  };
}

export function withKey(keys: ApiKeys, name: KeyName, value: string): ApiKeys {
  const next = { ...keys };
  if (value.trim()) next[name] = value;
  else delete next[name];
  return next;
}

function legacyServerUrl(stored: AiSettingsStored): string {
  if (trimmed(stored.aiServerUrl)) return '';
  const url = trimmed(stored.aiBaseUrl);
  return isCustomBaseUrl(AI_PROVIDERS[providerOrDefault(stored.aiProvider)], url) ? url : '';
}

export function aiChoice(stored: AiSettingsStored): AiChoice {
  if (stored.aiProvider === SERVER || legacyServerUrl(stored)) return SERVER;
  return providerOrDefault(stored.aiProvider);
}

export function resolveServer(stored: AiSettingsStored): AiServer | null {
  const legacy = legacyServerUrl(stored);
  const url = trimmed(stored.aiServerUrl) || legacy;
  if (!url) return null;
  const keys = readApiKeys(stored);
  const provider = providerOrDefault(stored.aiProvider);
  const protocol =
    stored.aiServerProtocol === 'anthropic' ||
    (stored.aiServerProtocol === undefined && legacy && AI_PROVIDERS[provider].protocol === 'anthropic')
      ? 'anthropic'
      : 'openai';
  return { url, protocol, apiKey: keys.server ?? (legacy ? (keys[provider] ?? '') : '') };
}

export interface AiCredentials {
  provider: AIProviderKey;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export function resolveAiCredentials(stored: AiSettingsStored): AiCredentials | null {
  const model = trimmed(stored.aiModel);
  if (aiChoice(stored) === SERVER) {
    const server = resolveServer(stored);
    if (!server || !model) return null;
    return { provider: server.protocol, model, apiKey: server.apiKey, baseUrl: server.url };
  }
  const provider = providerOrDefault(stored.aiProvider);
  const apiKey = readApiKeys(stored)[provider] ?? '';
  if (!apiKey) return null;
  return { provider, apiKey, model: model || AI_PROVIDERS[provider].defaultModel };
}
