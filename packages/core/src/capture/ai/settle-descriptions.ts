import { clearStepAiPending, getStepsForGuide } from '@/core/guides/service';
import { drainDescriptions } from './description-queue';

export async function settleDescriptions(guideId: string): Promise<void> {
  await drainDescriptions(guideId);
  const pending = (await getStepsForGuide(guideId)).filter((step) => step.aiPending);
  await Promise.all(pending.map((step) => clearStepAiPending(step.id)));
}
