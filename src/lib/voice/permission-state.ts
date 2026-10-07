import type { VoicePermissionQueryResponse, VoicePermissionState } from './voice-message';

export async function permissionState(): Promise<VoicePermissionQueryResponse> {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return { state: result.state as VoicePermissionState };
  } catch {
    return { state: 'unknown' };
  }
}
