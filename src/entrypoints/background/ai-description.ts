import { getAIDescription } from '@/core/capture/ai/description';
import { isConnectionConfigured } from '@/core/capture/ai/provider';
import type { DOMContext } from '@/core/capture/dom/context';
import { localStorage } from '@/lib/browser-api';

export async function generateAiDescription(domContext: DOMContext): Promise<string | undefined> {
  const settings = await localStorage.get(['aiApiKey', 'aiProvider', 'aiModel', 'aiBaseUrl']);
  const provider = (settings.aiProvider as string) || 'openai';
  const model = (settings.aiModel as string) || 'gpt-4o-mini';
  const connection = {
    provider,
    model,
    apiKey: settings.aiApiKey as string,
    baseURL: settings.aiBaseUrl as string | undefined,
  };
  if (!isConnectionConfigured(connection)) return undefined;

  const description = await getAIDescription(domContext, connection);
  return description || undefined;
}
