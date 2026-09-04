import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export function createModel(provider: string, model: string, apiKey: string) {
  if (provider === 'anthropic') return createAnthropic({ apiKey })(model);
  // OpenRouter speaks the chat completions dialect, not the responses API the
  // openai provider reaches for by default.
  if (provider === 'openrouter')
    return createOpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL, name: 'openrouter' }).chat(model);
  return createOpenAI({ apiKey })(model);
}
