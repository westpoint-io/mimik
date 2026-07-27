import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export function createModel(provider: string, model: string, apiKey: string) {
  if (provider === 'anthropic') return createAnthropic({ apiKey })(model);
  if (provider === 'openrouter') {
    return createOpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL })(model);
  }
  return createOpenAI({ apiKey })(model);
}
