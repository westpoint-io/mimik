import { logger } from '@mimik/core/logger';
import { getAIDescription } from '@/core/capture/ai/description';
import { describeAiFailure } from '@/core/capture/ai/errors';
import { AI_CREDENTIAL_SETTINGS, resolveAiCredentials } from '@/core/capture/ai/keys';
import { type DOMContext, serializeDOMContext } from '@/core/capture/dom/context';
import { localStorage } from '@/lib/browser-api/local-storage';
import { broadcastAiToPanel } from '@/lib/port/broadcast-ai-to-panel';

export async function generateAiDescription(domContext: DOMContext): Promise<string | undefined> {
  const keys = resolveAiCredentials(await localStorage.get([...AI_CREDENTIAL_SETTINGS]));
  if (!keys) return undefined;
  const { provider } = keys;

  try {
    const description = await getAIDescription(
      serializeDOMContext(domContext),
      provider,
      keys.model,
      keys.apiKey,
      keys.baseUrl,
    );
    return description || undefined;
  } catch (err) {
    const failure = describeAiFailure(err);
    logger.error(`AI description failed (${failure.reason}${failure.status ? ` ${failure.status}` : ''})`, err);
    broadcastAiToPanel({ type: 'AI_UPDATE', reason: failure.reason, status: failure.status, provider });
    return undefined;
  }
}
