import { logger } from '@mimik/core/logger';
import { queueDescription } from '@/core/capture/ai/description-queue';
import { applyAiDescription, clearStepAiPending } from '@/core/guides/service';
import { generateAiDescription } from './ai-description';
import { takeDeferredDescription, takeDeferredDescriptions } from './deferred-descriptions';

export function describeStepNow(guideId: string, stepId: string): void {
  const domContext = takeDeferredDescription(guideId, stepId);
  logger.info('voice: nothing was said for this step, describing it instead', {
    stepId,
    hasDomContext: !!domContext,
  });
  queueDescription(guideId, async () => {
    const description = domContext ? await generateAiDescription(domContext) : undefined;
    await clearStepAiPending(stepId, description);
    logger.info('voice: step description settled', { stepId, wroteAi: !!description });
  });
}

export function describeUnnarratedSteps(guideId: string, narratedStepIds: readonly string[]): void {
  for (const { stepId, domContext } of takeDeferredDescriptions(guideId, narratedStepIds)) {
    queueDescription(guideId, async () => {
      const description = await generateAiDescription(domContext);
      if (description) await applyAiDescription(stepId, description);
    });
  }
}
