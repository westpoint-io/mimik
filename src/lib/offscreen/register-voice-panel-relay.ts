import { onMessage } from '../browser-api/on-message';
import { sendMessage } from '../browser-api/send-message';
import { isVoiceMessageFor } from '../voice/is-voice-message-for';
import { VOICE_SIDEPANEL_TARGET } from '../voice/voice-message';
import { IS_FIREFOX } from './constants';

export function registerVoicePanelRelay(): void {
  if (!IS_FIREFOX) return;
  onMessage((message) => {
    if (!isVoiceMessageFor(VOICE_SIDEPANEL_TARGET, message)) return undefined;
    void sendMessage(message as unknown as Record<string, unknown>).catch(() => undefined);
    return undefined;
  });
}
