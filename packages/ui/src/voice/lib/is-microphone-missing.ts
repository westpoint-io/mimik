import type { MicrophoneOption } from '../types';

export function isMicrophoneMissing(storedId: string, options: readonly MicrophoneOption[]): boolean {
  const id = storedId.trim();
  if (!id) return false;
  return !options.some((option) => option.deviceId === id);
}
