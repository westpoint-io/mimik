import { resolveAiKey } from '@mimik/core/capture/ai/keys';
import { AI_PROVIDERS } from '@mimik/core/capture/ai/models';
import { localStorage } from '@mimik/core/env';

const AI_SETTINGS = ['aiApiKeys', 'aiApiKey', 'aiProvider', 'aiModel', 'aiBaseUrl'] as const;

interface Credentials {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export async function credentials(): Promise<Credentials | null> {
  const stored = await localStorage.get(AI_SETTINGS);
  const { provider, apiKey } = resolveAiKey(stored);
  if (!apiKey) return null;
  return {
    provider,
    apiKey,
    model: (stored.aiModel as string) || AI_PROVIDERS[provider].defaultModel,
    baseUrl: (stored.aiBaseUrl as string) || undefined,
  };
}
