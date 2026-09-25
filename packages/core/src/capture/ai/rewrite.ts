import { generateText } from 'ai';
import { localStorage } from '@/core/env';
import { logger } from '@/core/logger';
import { AI_CREDENTIAL_SETTINGS, resolveAiCredentials } from './keys';
import { getLanguageSuffix, REWRITE_PROMPT } from './prompts';
import { createModel } from './provider';

export type RewriteError = 'no-api-key' | 'generation-failed';

export interface RewriteSelectionResponse {
  text?: string;
  error?: RewriteError;
}

const WRAPPED_IN_QUOTES = /^["“'](.*)["”']$/s;

export function cleanRewrite(raw: string): string {
  const trimmed = raw.trim();
  const unwrapped = trimmed.match(WRAPPED_IN_QUOTES);
  return (unwrapped ? unwrapped[1] : trimmed).trim();
}

export function buildRewritePrompt(text: string, instruction: string, locale: string): string {
  return (
    REWRITE_PROMPT.replace('{{text}}', () => text).replace('{{instruction}}', () => instruction) +
    getLanguageSuffix(locale)
  );
}

export async function rewriteSelection(text: string, instruction: string): Promise<RewriteSelectionResponse> {
  const settings = await localStorage.get([...AI_CREDENTIAL_SETTINGS, 'aiLanguage']);
  const keys = resolveAiCredentials(settings);
  if (!keys) return { error: 'no-api-key' };

  try {
    const { text: raw } = await generateText({
      model: createModel(keys.provider, keys.model, keys.apiKey, keys.baseUrl),
      prompt: buildRewritePrompt(text, instruction, (settings.aiLanguage as string) || 'en'),
      maxOutputTokens: 400,
    });

    const cleaned = cleanRewrite(raw);
    if (!cleaned) return { error: 'generation-failed' };
    return { text: cleaned };
  } catch (err) {
    logger.error('Selection rewrite failed', err);
    return { error: 'generation-failed' };
  }
}
