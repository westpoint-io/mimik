import { type GuideMeta, generateGuideMeta, guideMetaSteps } from '@mimik/core/capture/ai/meta';
import type { Step } from '@mimik/core/guides/types';
import { credentials } from './credentials';

export async function nameGuide(steps: Step[]): Promise<GuideMeta | null> {
  const keys = await credentials();
  if (!keys) return null;
  const described = guideMetaSteps(steps);
  if (described.length === 0) return null;
  try {
    return await generateGuideMeta(described, keys.provider, keys.model, keys.apiKey, keys.baseUrl);
  } catch {
    return null;
  }
}
