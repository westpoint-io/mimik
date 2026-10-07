import {
  VOICE_OFFSCREEN_TARGET,
  type VoiceAbortRequest,
  type VoiceAbortResponse,
  VoiceMessage,
  voiceMessage,
} from '../voice/voice-message';
import { request } from './request';

export function abortVoiceCapture(): Promise<VoiceAbortResponse> {
  return request(voiceMessage<VoiceAbortRequest>({ type: VoiceMessage.VOICE_ABORT, target: VOICE_OFFSCREEN_TARGET }));
}
