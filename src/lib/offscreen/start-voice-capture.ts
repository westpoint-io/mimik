import {
  VOICE_OFFSCREEN_TARGET,
  VoiceMessage,
  type VoiceStartRequest,
  type VoiceStartResponse,
  voiceMessage,
} from '../voice/voice-message';
import { answered } from './answered';

export function startVoiceCapture(deviceId?: string): Promise<VoiceStartResponse> {
  return answered<VoiceStartResponse>(
    voiceMessage<VoiceStartRequest>({ type: VoiceMessage.VOICE_START, target: VOICE_OFFSCREEN_TARGET, deviceId }),
    { started: false, reason: 'unsupported', error: 'No microphone host is available' },
  );
}
