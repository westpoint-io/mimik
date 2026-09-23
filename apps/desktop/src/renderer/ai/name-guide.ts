import { type GuideMeta, generateGuideMeta } from '@mimik/core/capture/ai/meta';
import { credentials } from './credentials';

export async function nameGuide(steps: { description: string }[]): Promise<GuideMeta | null> {
  const keys = await credentials();
  if (!keys) return null;
  const described = steps
    .filter((step) => step.description)
    .map((step) => ({ description: step.description, url: '' }));
  if (described.length === 0) return null;
  const trimmed = described.length > 15 ? [...described.slice(0, 10), ...described.slice(-5)] : described;
  try {
    return await generateGuideMeta(trimmed, keys.provider, keys.model, keys.apiKey, keys.baseUrl);
  } catch {
    return null;
  }
}
