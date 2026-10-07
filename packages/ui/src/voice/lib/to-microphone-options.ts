import type { MicrophoneDevice, MicrophoneOption } from '../types';
import { audioInputs } from './audio-inputs';

const GENERIC_DEVICE_IDS = new Set(['default', 'communications']);

export function toMicrophoneOptions(devices: readonly MicrophoneDevice[]): MicrophoneOption[] {
  const seen = new Set<string>();
  const options: MicrophoneOption[] = [];
  for (const device of audioInputs(devices)) {
    const deviceId = device.deviceId.trim();
    if (!deviceId || GENERIC_DEVICE_IDS.has(deviceId) || seen.has(deviceId)) continue;
    seen.add(deviceId);
    options.push({ deviceId, label: device.label.trim() });
  }
  return options;
}
