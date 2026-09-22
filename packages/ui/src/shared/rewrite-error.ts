import type { RewriteError } from '@mimik/core/capture/ai/rewrite';
import { i18n } from '@mimik/core/env';

const REWRITE_ERROR_KEYS = {
  'no-api-key': 'editor.rewriteErrorNoApiKey',
  'generation-failed': 'editor.rewriteErrorFailed',
} as const satisfies Record<RewriteError, string>;

export function rewriteErrorMessage(error: RewriteError): string {
  return i18n.t(REWRITE_ERROR_KEYS[error]);
}
