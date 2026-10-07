import { logger } from '@mimik/core/logger';
import { i18n } from '#imports';
import { AI_CREDENTIAL_SETTINGS, resolveAiCredentials } from '@/core/capture/ai/keys';
import { generateGuideMeta, guideMetaSteps } from '@/core/capture/ai/meta';
import {
  clearStepAiPending,
  getGuideDomain,
  getStepsForGuide,
  updateGuideDescription,
  updateGuideTitle,
} from '@/core/guides/service';
import { localStorage } from '@/lib/browser-api/local-storage';
import type { GenerateGuideDescriptionResponse, GuideDescriptionError } from '@/lib/messaging';
import { drainDescriptions } from './description-queue';
import { whenNarrationSettled } from './voice';

type ResolveFailure = Extract<GuideDescriptionError, 'no-api-key' | 'no-steps'>;

type GuideMetaInputs =
  | {
      ok: true;
      steps: { description: string; url: string }[];
      provider: string;
      model: string;
      apiKey: string;
      baseUrl?: string;
    }
  | { ok: false; reason: ResolveFailure };

async function resolveGuideMetaInputs(guideId: string): Promise<GuideMetaInputs> {
  const keys = resolveAiCredentials(await localStorage.get([...AI_CREDENTIAL_SETTINGS]));
  if (!keys) return { ok: false, reason: 'no-api-key' };

  const steps = guideMetaSteps(await getStepsForGuide(guideId));
  if (steps.length === 0) return { ok: false, reason: 'no-steps' };

  return { ok: true, steps, ...keys };
}

async function applyFallbackTitle(guideId: string) {
  const domain = await getGuideDomain(guideId);
  await updateGuideTitle(
    guideId,
    domain ? i18n.t('background.guideOnDomain', [domain]) : i18n.t('background.newGuide'),
  );
}

export async function settlePendingDescriptions(guideId: string) {
  await whenNarrationSettled();
  await drainDescriptions(guideId);
  const pending = (await getStepsForGuide(guideId)).filter((s) => s.aiPending);
  await Promise.all(pending.map((s) => clearStepAiPending(s.id)));
}

export async function generateGuideMetaOnStop(guideId: string) {
  try {
    await settlePendingDescriptions(guideId);
    const inputs = await resolveGuideMetaInputs(guideId);
    if (!inputs.ok) {
      if (inputs.reason === 'no-api-key') await applyFallbackTitle(guideId);
      return;
    }

    const meta = await generateGuideMeta(inputs.steps, inputs.provider, inputs.model, inputs.apiKey, inputs.baseUrl);
    if (!meta) {
      await applyFallbackTitle(guideId);
      return;
    }

    await updateGuideTitle(guideId, meta.title);
    logger.info('Generated guide meta:', meta.title);
    if (meta.description) {
      await updateGuideDescription(guideId, meta.description).catch((err) =>
        logger.error('Guide description write failed', err),
      );
    }
  } catch (err) {
    logger.error('Guide meta generation failed', err);
    await applyFallbackTitle(guideId);
  }
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
