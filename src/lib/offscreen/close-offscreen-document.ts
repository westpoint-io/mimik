import { logger } from '@mimik/core/logger';
import { hasOffscreenDocument } from './has-offscreen-document';
import { offscreenApi } from './offscreen-api';

export async function closeOffscreenDocument(): Promise<void> {
  const api = offscreenApi();
  if (!api) return;
  if (!(await hasOffscreenDocument())) return;
  try {
    await api.closeDocument();
  } catch (error) {
    logger.error('voice: failed to close the offscreen document', error);
  }
}
