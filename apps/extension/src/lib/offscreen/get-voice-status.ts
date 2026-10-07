import {
  VOICE_OFFSCREEN_TARGET,
  VoiceMessage,
  type VoiceStatusRequest,
  type VoiceStatusResponse,
  voiceMessage,
} from '../voice/voice-message';
import { request } from './request';

export function getVoiceStatus(): Promise<VoiceStatusResponse> {
  return request(voiceMessage<VoiceStatusRequest>({ type: VoiceMessage.VOICE_STATUS, target: VOICE_OFFSCREEN_TARGET }));
}
