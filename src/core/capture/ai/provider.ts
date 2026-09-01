import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

export function createModel(provider: string, model: string, apiKey: string, baseUrl?: string) {
  if (provider === 'anthropic') return createAnthropic({ apiKey })(model);
  if (provider === 'openaiCompatible') {
    const baseURL = baseUrl?.trim();
    return createOpenAI(baseURL ? { apiKey, baseURL } : { apiKey })(model);
  }
  return createOpenAI({ apiKey })(model);
}
