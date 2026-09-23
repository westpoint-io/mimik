import { logger } from '@mimik/core/logger';
import { onMessage } from '../browser-api/on-message';
import { createVoiceHost, type VoiceHost } from './create-voice-host';
import { isVoiceMessageFor } from './is-voice-message-for';
import { VOICE_OFFSCREEN_TARGET, type VoiceRequest } from './voice-message';

export function startVoiceHost(): VoiceHost {
  const host = createVoiceHost();

  onMessage((message, _sender, sendResponse) => {
    if (!isVoiceMessageFor(VOICE_OFFSCREEN_TARGET, message)) return undefined;
    host
      .handle(message as VoiceRequest)
      .then(sendResponse)
      .catch((error: unknown) => {
        logger.error('voice: host could not handle request', message, error);
        sendResponse({ ok: false, started: false, reason: 'unknown', error: String(error) });
      });
    return true;
  });

  return host;
}
