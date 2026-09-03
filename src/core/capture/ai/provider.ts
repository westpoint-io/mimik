import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

export function createModel(provider: string, model: string, apiKey: string) {
  if (provider === 'anthropic') return createAnthropic({ apiKey })(model);
  if (provider === 'openrouter') {
    return createOpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    })(model);
  }
  return createOpenAI({ apiKey })(model);
}
