import { SYSTEM_DEFAULT_VALUE } from './to-select-value';

export function toStoredMicrophoneId(value: string): string {
  return value === SYSTEM_DEFAULT_VALUE ? '' : value.trim();
}
