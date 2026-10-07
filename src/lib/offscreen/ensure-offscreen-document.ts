import { logger } from '@mimik/core/logger';
import { getExtensionURL } from '../browser-api/get-extension-url';
import { hasOffscreenDocument } from './has-offscreen-document';
import { offscreenApi } from './offscreen-api';

const OFFSCREEN_PATH = '/offscreen.html';
const OFFSCREEN_REASON = 'USER_MEDIA';
const OFFSCREEN_JUSTIFICATION = 'Recording microphone narration while a guide is being captured';

const creating: { current: Promise<void> | null } = { current: null };

export async function ensureOffscreenDocument(): Promise<boolean> {
  const api = offscreenApi();
  if (!api) return false;
  if (await hasOffscreenDocument()) return true;

  creating.current ??= api.createDocument({
    url: getExtensionURL(OFFSCREEN_PATH),
    reasons: [OFFSCREEN_REASON],
    justification: OFFSCREEN_JUSTIFICATION,
  });

  try {
    await creating.current;
    return true;
  } catch (error) {
    logger.error('voice: failed to create the offscreen document', error);
    return hasOffscreenDocument();
  } finally {
    creating.current = null;
  }
}
