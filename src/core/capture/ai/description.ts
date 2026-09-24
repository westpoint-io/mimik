import { generateText } from 'ai';
import { localStorage } from '@/lib/browser-api';
import type { DOMContext } from '../dom/context';
import { serializeDOMContext } from '../dom/context';
import { formatExamples, resolveExamples } from './examples';
import { getLanguageSuffix, STEP_DESCRIPTION_PROMPT } from './prompts';
import { createModel } from './provider';
import { unwrapQuotes } from './text';

export async function getAIDescription(
  domContext: DOMContext,
  provider: string,
  model: string,
  apiKey: string,
  baseUrl?: string,
): Promise<string | null> {
  const settings = await localStorage.get(['aiLanguage']);
  const locale = (settings.aiLanguage as string) || 'en';
  const context = serializeDOMContext(domContext);
  const prompt = STEP_DESCRIPTION_PROMPT.replace('{{examples}}', formatExamples(resolveExamples(locale).steps)).replace(
    '{{context}}',
    () => context,
  );
  const { text } = await generateText({
    model: createModel(provider, model, apiKey, baseUrl),
    prompt: prompt + getLanguageSuffix(locale),
    maxOutputTokens: 50,
  });
  return unwrapQuotes(text) || null;
}
