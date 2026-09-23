import { i18n } from '@mimik/core/env';
import type { GuideDescriptionError } from '@mimik/ui/env';

const DESCRIPTION_ERROR_KEYS = {
  'no-api-key': 'editor.descriptionErrorNoApiKey',
  'no-steps': 'editor.descriptionErrorNoSteps',
  'generation-failed': 'editor.descriptionErrorFailed',
  'save-failed': 'editor.descriptionErrorSaveFailed',
} as const satisfies Record<GuideDescriptionError, string>;

export function guideDescriptionErrorMessage(error: GuideDescriptionError): string {
  return i18n.t(DESCRIPTION_ERROR_KEYS[error]);
}
