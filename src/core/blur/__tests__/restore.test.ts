import { describe, expect, it } from 'vitest';
import { CaptureState } from '@/core/capture/machine';
import type { GetStateResponse } from '@/lib/messaging';
import { shouldReopenBlur } from '../restore';

const state = (over: Partial<GetStateResponse> = {}): GetStateResponse => ({
  state: CaptureState.PAUSED,
  stepCount: 1,
  currentGuideId: 'guide-1',
  pauseReason: 'blur',
  ...over,
});

describe('shouldReopenBlur', () => {
  it('re-opens in the top frame of a recording paused for blur', () => {
    expect(shouldReopenBlur(state(), true)).toBe(true);
  });

  // The overlay is a top-frame singleton; without this every iframe on the
  // page would mount its own panel.
  it('never re-opens in a subframe', () => {
    expect(shouldReopenBlur(state(), false)).toBe(false);
  });

  it('does not re-open for a manual pause, which has no overlay', () => {
    expect(shouldReopenBlur(state({ pauseReason: 'manual' }), true)).toBe(false);
  });

  it('does not re-open over a live recording', () => {
    expect(shouldReopenBlur(state({ state: CaptureState.RECORDING, pauseReason: null }), true)).toBe(false);
  });

  it('does not re-open when nothing is being recorded', () => {
    expect(shouldReopenBlur(state({ state: CaptureState.IDLE, currentGuideId: null, pauseReason: null }), true)).toBe(
      false,
    );
  });

  // A snapshot persisted before PAUSED existed restores with no reason at all.
  it('does not re-open when the reason is missing', () => {
    expect(shouldReopenBlur(state({ pauseReason: null }), true)).toBe(false);
  });
});
