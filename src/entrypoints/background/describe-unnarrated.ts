import { logger } from '@mimik/core/logger';
import { queueDescription } from '@/core/capture/ai/description-queue';
import { clearStepAiPending } from '@/core/guides/service';
import { takeDeferredDescription, takeDeferredDescriptions } from './deferred-descriptions';

export function describeStepNow(guideId: string, stepId: string): void {
  const describe = takeDeferredDescription(guideId, stepId);
  logger.info('voice: nothing was said for this step, describing it instead', { stepId, describable: !!describe });
  queueDescription(guideId, describe ?? (() => clearStepAiPending(stepId)));
}

export function describeUnnarratedSteps(guideId: string, narratedStepIds: readonly string[]): void {
  for (const { describe } of takeDeferredDescriptions(guideId, narratedStepIds)) queueDescription(guideId, describe);
}
