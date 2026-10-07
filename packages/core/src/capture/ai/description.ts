import { generateText } from 'ai';
import { localStorage } from '@/core/env';
import { formatExamples, resolveExamples } from './examples';
import { getLanguageSuffix, STEP_DESCRIPTION_PROMPT } from './prompts';
import { createModel } from './provider';
import { unwrapQuotes } from './text';

export async function getAIDescription(
  context: string,
  provider: string,
  model: string,
  apiKey: string,
  baseUrl?: string,
  template = STEP_DESCRIPTION_PROMPT,
): Promise<string | null> {
  const settings = await localStorage.get(['aiLanguage']);
  const locale = (settings.aiLanguage as string) || 'en';
  const prompt = template
    .replace('{{examples}}', formatExamples(resolveExamples(locale).steps))
    .replace('{{context}}', () => context);
  const { text } = await generateText({
    model: createModel(provider, model, apiKey, baseUrl),
    prompt: prompt + getLanguageSuffix(locale),
    maxOutputTokens: 50,
  });
  return unwrapQuotes(text) || null;
}
