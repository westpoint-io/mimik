import { createSnapshot, mergeGuideInto } from '@/core/guides/service';
import type { CaptureInsert } from '../capture-insert';
import { settleDescriptions } from './settle-descriptions';

export async function mergeRecording(
  guideId: string,
  { insertTargetGuideId, insertAtIndex }: Pick<CaptureInsert, 'insertTargetGuideId' | 'insertAtIndex'>,
  settleNarration: () => Promise<void>,
): Promise<void> {
  await settleNarration();
  await settleDescriptions(guideId);
  await createSnapshot(insertTargetGuideId);
  await mergeGuideInto(guideId, insertTargetGuideId, insertAtIndex);
}
