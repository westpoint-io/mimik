import { describe, expect, it } from 'vitest';
import { micToggleState } from '../mic-toggle-state';

describe('micToggleState', () => {
  it('turns on and off when transcription is ready', () => {
    expect(micToggleState(false, null, false)).toEqual({ locked: false, labelKey: 'voice.turnOn' });
    expect(micToggleState(true, null, false)).toEqual({ locked: false, labelKey: 'voice.turnOff' });
  });

  it('says what is missing when it is locked', () => {
    expect(micToggleState(false, 'missing-api-key', false)).toEqual({ locked: true, labelKey: 'voice.needsApiKey' });
    expect(micToggleState(false, 'server-not-ready', false)).toEqual({
      locked: true,
      labelKey: 'voice.errorServerNotReady',
    });
  });

  it('stays switchable off while on, and locked while paused', () => {
    expect(micToggleState(true, 'server-not-ready', false)).toEqual({ locked: false, labelKey: 'voice.turnOff' });
    expect(micToggleState(false, null, true)).toEqual({ locked: true, labelKey: 'voice.pausedWithCapture' });
  });
});
