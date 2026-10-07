import type { MicrophoneDevice } from '../types';

export function audioInputs(devices: readonly MicrophoneDevice[]): MicrophoneDevice[] {
  return devices.filter((device) => device.kind === 'audioinput');
}
