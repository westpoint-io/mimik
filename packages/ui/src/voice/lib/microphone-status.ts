import type { MicrophoneListState } from './microphone-list-state';

export type MicrophonePermission = PermissionState | 'unknown';

export type MicrophoneStatus = 'allowed' | 'blocked' | 'pending';

export function microphoneStatus(permission: MicrophonePermission, list: MicrophoneListState): MicrophoneStatus {
  if (permission === 'denied') return 'blocked';
  if (permission === 'granted' || list === 'ready') return 'allowed';
  return 'pending';
}
