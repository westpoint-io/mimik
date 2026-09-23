import type { VoicePermissionState } from '@/lib/voice/voice-message';

export const MICROPHONE: PermissionDescriptor = { name: 'microphone' as PermissionName };

export async function queryState(): Promise<VoicePermissionState> {
  try {
    const status = await navigator.permissions.query(MICROPHONE);
    return status.state as VoicePermissionState;
  } catch {
    return 'unknown';
  }
}
