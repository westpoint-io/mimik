import { getAIDescription } from '@/core/capture/ai/description';
import type { DOMContext } from '@/core/capture/dom/context';
import { localStorage } from '@/lib/browser-api';

export async function generateAiDescription(domContext: DOMContext): Promise<string | undefined> {
  const settings = await localStorage.get(['aiApiKey', 'aiProvider', 'aiModel', 'aiBaseUrl']);
  if (!settings.aiApiKey) return undefined;

  const provider = (settings.aiProvider as string) || 'openai';
  const model = (settings.aiModel as string) || 'gpt-4o-mini';
  const description = await getAIDescription(
    domContext,
    provider,
    model,
    settings.aiApiKey as string,
    settings.aiBaseUrl as string | undefined,
  );
  return description || undefined;
}
