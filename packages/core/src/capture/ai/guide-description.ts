import { localStorage } from '@/core/env';
import { getStepsForGuide, updateGuideDescription } from '@/core/guides/service';
import { logger } from '@/core/logger';
import { AI_CREDENTIAL_SETTINGS, resolveAiCredentials } from './keys';
import { generateGuideMeta, guideMetaSteps } from './meta';

export type GuideDescriptionError = 'no-api-key' | 'no-steps' | 'generation-failed' | 'save-failed';

export interface GenerateGuideDescriptionResponse {
  description?: string;
  error?: GuideDescriptionError;
}

type GuideMetaInputs =
  | {
      ok: true;
      steps: { description: string; place: string }[];
      provider: string;
      model: string;
      apiKey: string;
      baseUrl?: string;
    }
  | { ok: false; reason: Extract<GuideDescriptionError, 'no-api-key' | 'no-steps'> };

export async function resolveGuideMetaInputs(guideId: string): Promise<GuideMetaInputs> {
  const keys = resolveAiCredentials(await localStorage.get([...AI_CREDENTIAL_SETTINGS]));
  if (!keys) return { ok: false, reason: 'no-api-key' };

  const steps = guideMetaSteps(await getStepsForGuide(guideId));
  if (steps.length === 0) return { ok: false, reason: 'no-steps' };

  return { ok: true, steps, ...keys };
}

export async function generateDescriptionOnDemand(guideId: string): Promise<GenerateGuideDescriptionResponse> {
  try {
    const inputs = await resolveGuideMetaInputs(guideId);
    if (!inputs.ok) return { error: inputs.reason };

    const meta = await generateGuideMeta(inputs.steps, inputs.provider, inputs.model, inputs.apiKey, inputs.baseUrl);
    if (!meta?.description) return { error: 'generation-failed' };

    await updateGuideDescription(guideId, meta.description);
    return { description: meta.description };
  } catch (err) {
    logger.error('On-demand description generation failed', err);
    return { error: 'save-failed' };
  }
}
