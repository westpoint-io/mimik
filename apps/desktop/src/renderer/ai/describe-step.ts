import { getAIDescription } from '@mimik/core/capture/ai/description';
import { serializeScreenContext } from '@mimik/core/capture/ai/screen-context';
import type { ElementMeta } from '@mimik/core/guides/types';
import { credentials } from './credentials';

export async function describeStep(action: string, meta: ElementMeta): Promise<string | null> {
  const keys = await credentials();
  if (!keys) return null;
  try {
    return await getAIDescription(
      serializeScreenContext(action, meta),
      keys.provider,
      keys.model,
      keys.apiKey,
      keys.baseUrl,
    );
  } catch {
    return null;
  }
}
