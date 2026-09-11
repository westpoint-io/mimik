import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

export function createModel(provider: string, model: string, apiKey: string, baseUrl?: string) {
  if (provider === 'anthropic') return createAnthropic({ apiKey })(model);
  if (provider === 'openaiCompatible') {
    const baseURL = baseUrl?.trim();
    return createOpenAI(baseURL ? { apiKey, baseURL } : { apiKey })(model);
  }
  if (provider === 'deepseek') return createOpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL, name: 'deepseek' })(model);
  return createOpenAI({ apiKey })(model);
}
