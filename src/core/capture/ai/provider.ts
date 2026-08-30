import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { normalizeBaseUrl } from './models';

export function createModel(provider: string, model: string, apiKey: string, baseUrl?: string) {
  if (provider === 'anthropic') return createAnthropic({ apiKey })(model);
  const trimmed = baseUrl ? normalizeBaseUrl(baseUrl) : '';
  if (trimmed) return createOpenAI({ apiKey, baseURL: trimmed })(model);
  return createOpenAI({ apiKey })(model);
}
