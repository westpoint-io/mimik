import { AI_PROVIDERS, type AIProviderKey, isProviderKey, providerOrDefault } from './models';

export type AIApiKeys = Partial<Record<AIProviderKey, string>>;

export function parseApiKeys(value: unknown): AIApiKeys {
  if (typeof value !== 'object' || value === null) return {};
  const keys: AIApiKeys = {};
  for (const [provider, key] of Object.entries(value as Record<string, unknown>)) {
    if (!isProviderKey(provider)) continue;
    const trimmed = typeof key === 'string' ? key.trim() : '';
    if (trimmed) keys[provider] = trimmed;
  }
  return keys;
}

export function migrateApiKeys(stored: { aiApiKeys?: unknown; aiApiKey?: unknown; aiProvider?: unknown }): AIApiKeys {
  const keys = parseApiKeys(stored.aiApiKeys);
  if (Object.keys(keys).length > 0) return keys;

  const legacy = typeof stored.aiApiKey === 'string' ? stored.aiApiKey.trim() : '';
  return legacy ? { [providerOrDefault(stored.aiProvider)]: legacy } : {};
}

export function keyFor(keys: AIApiKeys, provider: AIProviderKey): string {
  return keys[provider] ?? '';
}

export function withKeyFor(keys: AIApiKeys, provider: AIProviderKey, apiKey: string): AIApiKeys {
  const next = { ...keys };
  const trimmed = apiKey.trim();
  if (trimmed) next[provider] = apiKey;
  else delete next[provider];
  return next;
}

export const AI_KEY_SETTINGS = ['aiApiKeys', 'aiApiKey', 'aiProvider'] as const;

export function resolveAiKey(stored: { aiApiKeys?: unknown; aiApiKey?: unknown; aiProvider?: unknown }): {
  provider: AIProviderKey;
  apiKey: string;
} {
  const provider = providerOrDefault(stored.aiProvider);
  return { provider, apiKey: keyFor(migrateApiKeys(stored), provider) };
}

export const AI_CREDENTIAL_SETTINGS = [...AI_KEY_SETTINGS, 'aiModel', 'aiBaseUrl'] as const;

export interface AiCredentials {
  provider: AIProviderKey;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export function resolveAiCredentials(stored: {
  aiApiKeys?: unknown;
  aiApiKey?: unknown;
  aiProvider?: unknown;
  aiModel?: unknown;
  aiBaseUrl?: unknown;
}): AiCredentials | null {
  const { provider, apiKey } = resolveAiKey(stored);
  if (!apiKey) return null;
  return {
    provider,
    apiKey,
    model: (typeof stored.aiModel === 'string' && stored.aiModel) || AI_PROVIDERS[provider].defaultModel,
    baseUrl: typeof stored.aiBaseUrl === 'string' ? stored.aiBaseUrl : undefined,
  };
}
