import { logger } from '@mimik/core/logger';
import { i18n } from '#imports';
import { resolveGuideMetaInputs } from '@/core/capture/ai/guide-description';
import { AI_KEY_SETTINGS, resolveAiKey } from '@/core/capture/ai/keys';
import { generateGuideMeta } from '@/core/capture/ai/meta';
import { settleDescriptions } from '@/core/capture/ai/settle-descriptions';
import { localStorage } from '@/core/env';
import { getGuideDomain, updateGuideDescription, updateGuideTitle } from '@/core/guides/service';
import { whenNarrationSettled } from './voice';

async function hasAiKey(): Promise<boolean> {
  return Boolean(resolveAiKey(await localStorage.get([...AI_KEY_SETTINGS])).apiKey);
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
  await settleDescriptions(guideId);
}

async function applyFallbackTitleThenSettle(guideId: string) {
  const titled = applyFallbackTitle(guideId).catch((err) => logger.error('Fallback title write failed', err));
  await settlePendingDescriptions(guideId).catch((err) => logger.error('Settling step descriptions failed', err));
  await titled;
}

export async function generateGuideMetaOnStop(guideId: string) {
  if (!(await hasAiKey().catch(() => false))) {
    await applyFallbackTitleThenSettle(guideId);
    return;
  }

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
