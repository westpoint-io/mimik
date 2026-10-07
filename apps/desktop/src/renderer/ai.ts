import { getAIDescription } from '@mimik/core/capture/ai/description';
import { resolveAiKey } from '@mimik/core/capture/ai/keys';
import { type GuideMeta, generateGuideMeta } from '@mimik/core/capture/ai/meta';
import { AI_PROVIDERS } from '@mimik/core/capture/ai/models';
import { serializeScreenContext } from '@mimik/core/capture/ai/screen-context';
import { localStorage } from '@mimik/core/env';
import type { ElementMeta } from '@mimik/core/guides/types';

const AI_SETTINGS = ['aiApiKeys', 'aiApiKey', 'aiProvider', 'aiModel', 'aiBaseUrl'] as const;

interface Credentials {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

async function credentials(): Promise<Credentials | null> {
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

export async function describeStep(action: string, meta: ElementMeta): Promise<string | null> {
  const keys = await credentials();
  if (!keys) return null;
  try {
    return await getAIDescription(
      serializeScreenContext(action, meta),
      keys.provider,
      keys.model,
      keys.apiKey,
      keys.baseUrl,
    );
  } catch {
    return null;
  }
}

export async function nameGuide(steps: { description: string }[]): Promise<GuideMeta | null> {
  const keys = await credentials();
  if (!keys) return null;
  const described = steps
    .filter((step) => step.description)
    .map((step) => ({ description: step.description, url: '' }));
  if (described.length === 0) return null;
  const trimmed = described.length > 15 ? [...described.slice(0, 10), ...described.slice(-5)] : described;
  try {
    return await generateGuideMeta(trimmed, keys.provider, keys.model, keys.apiKey, keys.baseUrl);
  } catch {
    return null;
  }
}
