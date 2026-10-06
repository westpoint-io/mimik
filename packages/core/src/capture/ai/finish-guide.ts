import { updateGuideDescription, updateGuideTitle } from '@/core/guides/service';
import { logger } from '@/core/logger';
import { resolveGuideMetaInputs } from './guide-description';
import { generateGuideMeta } from './meta';
import { readAiCredentials } from './read-ai-credentials';
import { settleDescriptions } from './settle-descriptions';

export interface FinishGuideOptions {
  fallbackTitle: (guideId: string) => Promise<string>;
  settleNarration: () => Promise<void>;
}

export async function finishGuide(guideId: string, { fallbackTitle, settleNarration }: FinishGuideOptions) {
  const applyFallbackTitle = async () => updateGuideTitle(guideId, await fallbackTitle(guideId));
  const settle = async () => {
    await settleNarration();
    await settleDescriptions(guideId);
  };

  const keys = await readAiCredentials().catch(() => null);
  if (!keys) {
    const titled = applyFallbackTitle().catch((err) => logger.error('Fallback title write failed', err));
    await settle().catch((err) => logger.error('Settling step descriptions failed', err));
    await titled;
    return;
  }

  try {
    await settle();
    const inputs = await resolveGuideMetaInputs(guideId);
    const meta = inputs.ok
      ? await generateGuideMeta(inputs.steps, inputs.provider, inputs.model, inputs.apiKey, inputs.baseUrl)
      : null;
    if (!meta) {
      await applyFallbackTitle();
      return;
    }
    await updateGuideTitle(guideId, meta.title);
    if (meta.description) {
      await updateGuideDescription(guideId, meta.description).catch((err) =>
        logger.error('Guide description write failed', err),
      );
    }
  } catch (err) {
    logger.error('Guide meta generation failed', err);
    await applyFallbackTitle();
  }
}
