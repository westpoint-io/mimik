import { applyNarrationToSteps, findExistingStepIds, saveTranscript } from '@/core/guides/service';
import { logger } from '@/core/logger';
import { discardDeferred } from './deferred-descriptions';
import { type NarrationUpdate, narrationUpdates } from './narration-updates';
import type { NarrationResult } from './types';

export async function applyNarrationResult(guideId: string, result: NarrationResult): Promise<NarrationUpdate[]> {
  await saveTranscript(guideId, result.transcript).catch((error: unknown) =>
    logger.warn('voice: the transcript could not be stored', error),
  );
  const surviving = await findExistingStepIds(result.descriptions.map((entry) => entry.stepId));
  const updates = narrationUpdates(result, surviving);
  await applyNarrationToSteps(updates, result.transcript.epochMs);
  discardDeferred(
    guideId,
    updates.map((update) => update.stepId),
  );
  return updates;
}
