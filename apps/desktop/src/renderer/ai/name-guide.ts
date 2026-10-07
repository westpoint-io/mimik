import { resolveGuideMetaInputs } from '@mimik/core/capture/ai/guide-description';
import { type GuideMeta, generateGuideMeta } from '@mimik/core/capture/ai/meta';

export async function nameGuide(guideId: string): Promise<GuideMeta | null> {
  const inputs = await resolveGuideMetaInputs(guideId);
  if (!inputs.ok) return null;
  try {
    return await generateGuideMeta(inputs.steps, inputs.provider, inputs.model, inputs.apiKey, inputs.baseUrl);
  } catch {
    return null;
  }
}
