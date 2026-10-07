import {
  VOICE_OFFSCREEN_TARGET,
  VoiceMessage,
  type VoiceStepMark,
  type VoiceStopRequest,
  type VoiceStopResponse,
  type VoiceTranscriptionSettings,
  voiceMessage,
} from '../voice/voice-message';
import { answered } from './answered';

export function stopVoiceCapture(
  guideId: string,
  steps: VoiceStepMark[],
  settings: VoiceTranscriptionSettings,
): Promise<VoiceStopResponse> {
  return answered<VoiceStopResponse>(
    voiceMessage<VoiceStopRequest>({
      type: VoiceMessage.VOICE_STOP,
      target: VOICE_OFFSCREEN_TARGET,
      guideId,
      steps,
      settings,
    }),
    { ok: false, reason: 'stream-ended', error: 'The microphone host is no longer available' },
  );
}
