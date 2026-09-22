import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { coreFetch } from '@/core/env';
import { AI_PROVIDERS, DEFAULT_AI_PROVIDER, findProvider, openAITransport, resolveBaseUrl } from './models';

export function createModel(provider: string, model: string, apiKey: string, baseUrl?: string) {
  const config = findProvider(provider) ?? AI_PROVIDERS[DEFAULT_AI_PROVIDER];
  const baseURL = resolveBaseUrl(config, baseUrl);
  if (config.protocol === 'anthropic') return createAnthropic({ apiKey, baseURL, fetch: coreFetch })(model);
  const openai = createOpenAI({ apiKey, baseURL, name: provider, fetch: coreFetch });
  return openAITransport(config, baseUrl) === 'responses' ? openai(model) : openai.chat(model);
}
