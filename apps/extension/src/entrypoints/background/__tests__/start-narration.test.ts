import { describe, expect, it } from 'vitest';
import { CaptureState } from '@/core/capture/machine';
import { canStartNarrationNow } from '../voice';

describe('canStartNarrationNow', () => {
  it('starts narration when a recording is running and narration is not', () => {
    expect(canStartNarrationNow(CaptureState.RECORDING, 'idle')).toBe(true);
  });

  it('does not start when nothing is being recorded', () => {
    expect(canStartNarrationNow(CaptureState.IDLE, 'idle')).toBe(false);
  });

  it('does not start a second capture when narration is already running', () => {
    expect(canStartNarrationNow(CaptureState.RECORDING, 'recording')).toBe(false);
  });

  it('does not start while a previous take is still transcribing', () => {
    expect(canStartNarrationNow(CaptureState.RECORDING, 'transcribing')).toBe(false);
  });

  it('starts again after a failed take', () => {
    expect(canStartNarrationNow(CaptureState.RECORDING, 'error')).toBe(true);
  });
});
