import { logger } from '@mimik/core/logger';
import { isVoiceStatus } from '../voice/is-voice-status';
import { closeOffscreenDocument } from './close-offscreen-document';
import { IS_FIREFOX } from './constants';
import { getVoiceStatus } from './get-voice-status';

export async function closeVoiceHostIfIdle(): Promise<void> {
  if (IS_FIREFOX) return;
  const status = await getVoiceStatus().catch(() => null);
  if (!isVoiceStatus(status)) {
    logger.warn('voice: host status unavailable, leaving the document open');
    return;
  }
  if (status.recording || status.transcribing) return;
  await closeOffscreenDocument();
}
