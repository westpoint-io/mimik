import { logger } from '@mimik/core/logger';
import { sendMessage } from '../browser-api/send-message';
import {
  VOICE_BACKGROUND_TARGET,
  VoiceMessage,
  type VoicePermissionResultEvent,
  voiceMessage,
} from '../voice/voice-message';

async function requestMicrophoneInPage(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return true;
  } catch (error) {
    logger.warn('voice: microphone access was not granted', error);
    return false;
  }
}

export async function promptForMicrophone(): Promise<void> {
  const granted = await requestMicrophoneInPage();
  void sendMessage(
    voiceMessage<VoicePermissionResultEvent>({
      type: VoiceMessage.VOICE_PERMISSION_RESULT,
      target: VOICE_BACKGROUND_TARGET,
      state: granted ? 'granted' : 'denied',
    }) as unknown as Record<string, unknown>,
  ).catch(() => undefined);
}
