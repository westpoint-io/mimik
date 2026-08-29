import { createAnthropic } from '@ai-sdk/anthropic';
import { createAzure } from '@ai-sdk/azure';
import { createOpenAI } from '@ai-sdk/openai';
import { normalizeEndpoint } from './endpoint';
import { AI_PROVIDERS } from './models';

export interface AIConnection {
  provider: string;
  model: string;
  apiKey: string;
  baseURL?: string;
}

export function isConnectionConfigured(connection: AIConnection): boolean {
  const { provider, apiKey, baseURL, model } = connection;
  const config = AI_PROVIDERS[provider];

  if (config?.requiresEndpoint) {
    if (!normalizeEndpoint(provider, baseURL ?? '')) return false;
    if (!model?.trim()) return false;
    return Boolean(apiKey);
  }

  return Boolean(apiKey);
}

export function createModel(connection: AIConnection) {
  const { provider, model, apiKey, baseURL } = connection;

  if (provider === 'anthropic') return createAnthropic({ apiKey })(model);

  const config = AI_PROVIDERS[provider];

  if (config?.requiresEndpoint) {
    const endpoint = normalizeEndpoint(provider, baseURL ?? '');
    if (!endpoint) throw new Error(`Missing or invalid endpoint for provider "${provider}"`);

    if (provider === 'azure') {
      return createAzure({ apiKey, baseURL: endpoint })(model);
    }
  }

  return createOpenAI({ apiKey })(model);
}
