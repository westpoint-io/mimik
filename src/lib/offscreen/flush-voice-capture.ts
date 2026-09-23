import {
  VOICE_OFFSCREEN_TARGET,
  type VoiceFlushRequest,
  type VoiceFlushResponse,
  VoiceMessage,
  type VoiceStepMark,
  type VoiceTranscriptionSettings,
  voiceMessage,
} from '../voice/voice-message';
import { answered } from './answered';

export function flushVoiceCapture(
  guideId: string,
  step: VoiceStepMark,
  settings: VoiceTranscriptionSettings,
): Promise<VoiceFlushResponse> {
  return answered<VoiceFlushResponse>(
    voiceMessage<VoiceFlushRequest>({
      type: VoiceMessage.VOICE_FLUSH,
      target: VOICE_OFFSCREEN_TARGET,
      guideId,
      step,
      settings,
    }),
    { ok: false, reason: 'stream-ended', error: 'The microphone host is no longer available' },
  );
}
