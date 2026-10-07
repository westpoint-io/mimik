import { i18n } from '@mimik/core/env';
import type { SnapshotDiff } from '@mimik/core/guides/snapshot-diff';

export function changeSummary(diff: SnapshotDiff): string {
  const parts: string[] = [];
  if (diff.titleChanged) parts.push(i18n.t('history.changeTitle'));
  if (diff.added === 1) parts.push(i18n.t('history.changeStepAdded', [String(diff.added)]));
  else if (diff.added > 1) parts.push(i18n.t('history.changeStepsAdded', [String(diff.added)]));
  if (diff.removed === 1) parts.push(i18n.t('history.changeStepRemoved', [String(diff.removed)]));
  else if (diff.removed > 1) parts.push(i18n.t('history.changeStepsRemoved', [String(diff.removed)]));
  if (diff.edited === 1) parts.push(i18n.t('history.changeStepEdited', [String(diff.edited)]));
  else if (diff.edited > 1) parts.push(i18n.t('history.changeStepsEdited', [String(diff.edited)]));
  if (diff.urls === 1) parts.push(i18n.t('history.changeLink', [String(diff.urls)]));
  else if (diff.urls > 1) parts.push(i18n.t('history.changeLinks', [String(diff.urls)]));
  if (diff.replaced === 1) parts.push(i18n.t('history.changeImageReplaced', [String(diff.replaced)]));
  else if (diff.replaced > 1) parts.push(i18n.t('history.changeImagesReplaced', [String(diff.replaced)]));
  if (diff.cropped === 1) parts.push(i18n.t('history.changeImageCropped', [String(diff.cropped)]));
  else if (diff.cropped > 1) parts.push(i18n.t('history.changeImagesCropped', [String(diff.cropped)]));
  if (diff.annotated === 1) parts.push(i18n.t('history.changeImageAnnotated', [String(diff.annotated)]));
  else if (diff.annotated > 1) parts.push(i18n.t('history.changeImagesAnnotated', [String(diff.annotated)]));
  if (diff.blurred === 1) parts.push(i18n.t('history.changeImageBlurred', [String(diff.blurred)]));
  else if (diff.blurred > 1) parts.push(i18n.t('history.changeImagesBlurred', [String(diff.blurred)]));
  if (diff.altEdited) parts.push(i18n.t('history.changeAltText'));
  if (diff.reordered) parts.push(i18n.t('history.changeStepReordered'));
  return parts.join(' · ');
}
