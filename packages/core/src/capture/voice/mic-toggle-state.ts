import type { TranscriptionBlocker } from './transcription-blocker';

export interface MicToggleState {
  locked: boolean;
  labelKey: string;
}

const BLOCKED_KEYS: Record<TranscriptionBlocker, string> = {
  'missing-api-key': 'voice.needsApiKey',
  'server-not-ready': 'voice.errorServerNotReady',
};

export function micToggleState(
  enabled: boolean,
  blocker: TranscriptionBlocker | null,
  paused: boolean,
): MicToggleState {
  const locked = (blocker !== null && !enabled) || paused;
  const labelKey = paused
    ? 'voice.pausedWithCapture'
    : locked && blocker
      ? BLOCKED_KEYS[blocker]
      : enabled
        ? 'voice.turnOff'
        : 'voice.turnOn';
  return { locked, labelKey };
}
