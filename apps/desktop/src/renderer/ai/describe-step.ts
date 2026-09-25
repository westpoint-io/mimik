import { getAIDescription } from '@mimik/core/capture/ai/description';
import { describeAiFailure } from '@mimik/core/capture/ai/errors';
import { serializeScreenContext } from '@mimik/core/capture/ai/screen-context';
import type { ElementMeta } from '@mimik/core/guides/types';
import { logger } from '@mimik/core/logger';
import type { OverlayAiFailure } from '../../main/overlay';
import { credentials } from './credentials';

export async function describeStep(
  action: string,
  meta: ElementMeta,
): Promise<{ text: string | null; failure: OverlayAiFailure | null }> {
  const keys = await credentials();
  if (!keys) return { text: null, failure: null };
  try {
    const text = await getAIDescription(
      serializeScreenContext(action, meta),
      keys.provider,
      keys.model,
      keys.apiKey,
      keys.baseUrl,
    );
    return { text: text || null, failure: null };
  } catch (err) {
    const failure = describeAiFailure(err);
    logger.error(`AI description failed (${failure.reason}${failure.status ? ` ${failure.status}` : ''})`, err);
    return { text: null, failure: { reason: failure.reason, provider: keys.provider } };
  }
}
