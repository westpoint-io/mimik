import { browser } from '#imports';
import {
  VOICE_BACKGROUND_TARGET,
  VoiceMessage,
  type VoicePermissionResultEvent,
  voiceMessage,
} from '@/lib/voice/voice-message';

export function report(state: 'granted' | 'denied'): void {
  const event = voiceMessage<VoicePermissionResultEvent>({
    type: VoiceMessage.VOICE_PERMISSION_RESULT,
    target: VOICE_BACKGROUND_TARGET,
    state,
  });
  browser.runtime.sendMessage(event).catch(() => undefined);
}
