import { generateObject, generateText, jsonSchema } from 'ai';
import { localStorage } from '@/lib/browser-api';
import { logger } from '@/lib/logger';
import { GUIDE_META_JSON_SUFFIX, GUIDE_META_PROMPT, getLanguageSuffix } from './prompts';
import { createModel } from './provider';

export interface GuideMeta {
  title: string;
  description?: string;
}

const MAX_TITLE_LENGTH = 70;
const MAX_BARE_TITLE_LENGTH = 100;
const FENCE = /^```(?:json)?\s*|\s*```$/g;

const guideMetaSchema = jsonSchema<{ title: string; description?: string | null }>({
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: ['string', 'null'] },
  },
  required: ['title', 'description'],
  additionalProperties: false,
});

function toGuideMeta(rawTitle: unknown, rawDescription: unknown): GuideMeta | null {
  let title = typeof rawTitle === 'string' ? rawTitle.trim().replace(/^"|"$/g, '') : '';
  if (!title) return null;
  if (title.length > MAX_TITLE_LENGTH) title = `${title.slice(0, MAX_TITLE_LENGTH - 3)}...`;

  const description =
    typeof rawDescription === 'string' ? rawDescription.trim().replace(/^"|"$/g, '') || undefined : undefined;
  return { title, description };
}

export function parseGuideMeta(raw: string): GuideMeta | null {
  const text = raw.trim().replace(FENCE, '').trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
      const meta = toGuideMeta(parsed.title, parsed.description);
      if (meta) return meta;
    } catch {
      logger.warn('Guide meta fallback returned malformed JSON');
    }
  }

  const line = text.split('\n')[0]?.trim() ?? '';
  if (!line || line.length > MAX_BARE_TITLE_LENGTH || line.includes('{')) return null;
  return toGuideMeta(line, null);
}

export async function generateGuideMeta(
  steps: { description: string; url: string }[],
  provider: string,
  model: string,
  apiKey: string,
  baseUrl?: string,
): Promise<GuideMeta | null> {
  if (steps.length === 0) return null;

  const formatted = steps.map((s, i) => `${i + 1}. [${s.url}] ${s.description}`).join('\n');
  const settings = await localStorage.get(['aiLanguage']);
  const locale = (settings.aiLanguage as string) || 'en';
  const prompt = GUIDE_META_PROMPT.replace('{{steps}}', formatted) + getLanguageSuffix(locale);
  const aiModel = createModel(provider, model, apiKey, baseUrl);

  try {
    const { object } = await generateObject({
      model: aiModel,
      schema: guideMetaSchema,
      prompt,
      maxOutputTokens: 200,
    });
    return toGuideMeta(object.title, object.description);
  } catch (err) {
    logger.warn('Structured guide meta failed, retrying as plain text', err);
  }

  try {
    const { text } = await generateText({
      model: aiModel,
      prompt: prompt + GUIDE_META_JSON_SUFFIX,
      maxOutputTokens: 200,
    });
    return parseGuideMeta(text);
  } catch (err) {
    logger.error('Guide meta generation failed', err);
    return null;
  }
}
