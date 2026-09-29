import type { MicrophoneDevice } from '../types';
import { audioInputs } from './audio-inputs';

export type MicrophoneListState = 'no-devices' | 'unlabelled' | 'ready';

export function microphoneListState(devices: readonly MicrophoneDevice[]): MicrophoneListState {
  const inputs = audioInputs(devices);
  if (inputs.length === 0) return 'no-devices';
  const withheld = inputs.some((device) => !device.deviceId.trim() || !device.label.trim());
  return withheld ? 'unlabelled' : 'ready';
}
