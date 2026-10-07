import { logger } from '@/core/logger';
import { getAIDescription } from './description';
import { type AiFailureUpdate, describeAiFailure } from './errors';
import { readAiCredentials } from './read-ai-credentials';
import { readAiUse } from './read-ai-use';

export interface StepDescription {
  text: string | null;
  failure: AiFailureUpdate | null;
}

export async function describeStep(context: string, prompt?: string): Promise<StepDescription> {
  const [keys, use] = await Promise.all([readAiCredentials(), readAiUse()]);
  if (!keys || !use.steps) return { text: null, failure: null };
  try {
    const text = await getAIDescription(context, keys.provider, keys.model, keys.apiKey, keys.baseUrl, prompt);
    return { text: text || null, failure: null };
  } catch (err) {
    const failure = describeAiFailure(err);
    logger.error(`AI description failed (${failure.reason}${failure.status ? ` ${failure.status}` : ''})`, err);
    return { text: null, failure: { reason: failure.reason, status: failure.status, provider: keys.provider } };
  }
}
