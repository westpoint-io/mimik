import { type AIProviderKey, isProviderKey, providerOrDefault } from './models';

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
