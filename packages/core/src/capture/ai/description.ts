import { generateText } from 'ai';
import { localStorage } from '@/core/env';
import { getLanguageSuffix, STEP_DESCRIPTION_PROMPT } from './prompts';
import { createModel } from './provider';

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
  const { text } = await generateText({
    model: createModel(provider, model, apiKey, baseUrl),
    prompt: template.replace('{{context}}', context) + getLanguageSuffix(locale),
    maxOutputTokens: 50,
  });
  return text.trim().replace(/^"|"$/g, '') || null;
}
