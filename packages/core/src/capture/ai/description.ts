import { generateText } from 'ai';
import { localStorage } from '@/core/env';
import { composePrompt } from './custom-prompts';
import { createModel } from './provider';
import { unwrapQuotes } from './text';

export async function getAIDescription(
  context: string,
  provider: string,
  model: string,
  apiKey: string,
  baseUrl?: string,
  headers?: Record<string, string>,
): Promise<string | null> {
  const settings = await localStorage.get(['aiLanguage', 'aiPrompts']);
  const locale = (settings.aiLanguage as string) || 'en';
  const { text } = await generateText({
    model: createModel(provider, model, apiKey, baseUrl, headers),
    prompt: composePrompt('steps', settings.aiPrompts, locale, context),
    maxOutputTokens: 1024,
  });
  return unwrapQuotes(text) || null;
}
