import { getAIDescription } from '@/core/capture/ai/description';
import { describeAiFailure } from '@/core/capture/ai/errors';
import { resolveAiKey } from '@/core/capture/ai/keys';
import { AI_PROVIDERS } from '@/core/capture/ai/models';
import type { DOMContext } from '@/core/capture/dom/context';
import { localStorage } from '@/lib/browser-api';
import { logger } from '@/lib/logger';
import { broadcastAiToPanel } from '@/lib/port';

export async function generateAiDescription(domContext: DOMContext): Promise<string | undefined> {
  const settings = await localStorage.get(['aiApiKeys', 'aiApiKey', 'aiProvider', 'aiModel', 'aiBaseUrl']);
  const { provider, apiKey } = resolveAiKey(settings);
  if (!apiKey) return undefined;

  const model = (settings.aiModel as string) || AI_PROVIDERS[provider].defaultModel;
  try {
    const description = await getAIDescription(
      domContext,
      provider,
      model,
      apiKey,
      settings.aiBaseUrl as string | undefined,
    );
    return description || undefined;
  } catch (err) {
    const failure = describeAiFailure(err);
    logger.error(`AI description failed (${failure.reason}${failure.status ? ` ${failure.status}` : ''})`, err);
    broadcastAiToPanel({ type: 'AI_UPDATE', reason: failure.reason, status: failure.status, provider });
    return undefined;
  }
}
