import {
  VOICE_OFFSCREEN_TARGET,
  VoiceMessage,
  type VoicePermissionQueryRequest,
  type VoicePermissionQueryResponse,
  voiceMessage,
} from '../voice/voice-message';
import { request } from './request';

export function queryMicPermission(): Promise<VoicePermissionQueryResponse> {
  return request(
    voiceMessage<VoicePermissionQueryRequest>({
      type: VoiceMessage.VOICE_PERMISSION_QUERY,
      target: VOICE_OFFSCREEN_TARGET,
    }),
  );
}
