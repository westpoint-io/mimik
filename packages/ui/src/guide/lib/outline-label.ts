import { i18n } from '@mimik/core/env';
import type { Step } from '@mimik/core/guides/types';

export function outlineLabel(step: Step): string {
  if (step.blockType === undefined && step.aiPending) return i18n.t('editor.writingStepDescription');
  const text = step.description.trim();
  if (text) return text;
  if (step.blockType === 'heading') return i18n.t('blocks.headingPlaceholder');
  if (step.blockType === 'callout') return i18n.t('blocks.calloutPlaceholder');
  return i18n.t('outline.untitledStep');
}
