import { generateText } from 'ai';
import { localStorage } from '@/lib/browser-api';
import { logger } from '@/lib/logger';
import type { RewriteSelectionResponse } from '@/lib/messaging';
import { resolveAiKey } from './keys';
import { AI_PROVIDERS } from './models';
import { getLanguageSuffix, REWRITE_PROMPT } from './prompts';
import { createModel } from './provider';

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
  const settings = await localStorage.get([
    'aiApiKeys',
    'aiApiKey',
    'aiProvider',
    'aiModel',
    'aiBaseUrl',
    'aiLanguage',
  ]);
  const { provider, apiKey } = resolveAiKey(settings);
  if (!apiKey) return { error: 'no-api-key' };

  try {
    const { text: raw } = await generateText({
      model: createModel(
        provider,
        (settings.aiModel as string) || AI_PROVIDERS[provider].defaultModel,
        apiKey,
        settings.aiBaseUrl as string | undefined,
      ),
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
