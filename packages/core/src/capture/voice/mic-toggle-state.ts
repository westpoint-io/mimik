export interface MicToggleState {
  locked: boolean;
  labelKey: string;
}

export function micToggleState(enabled: boolean, keyed: boolean, paused: boolean): MicToggleState {
  const locked = (!keyed && !enabled) || paused;
  const labelKey = paused
    ? 'voice.pausedWithCapture'
    : locked
      ? 'voice.needsApiKey'
      : enabled
        ? 'voice.turnOff'
        : 'voice.turnOn';
  return { locked, labelKey };
}
