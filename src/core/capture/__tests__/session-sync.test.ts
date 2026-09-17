// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GetStateResponse } from '@/lib/messaging';
import { CaptureState } from '../machine';

const sendMessage = vi.fn();
const startCapture = vi.fn((_guideId: string, _isTopFrame: boolean) => ({ stop: vi.fn() }));

vi.mock('@/lib/messaging', () => ({ sendMessage: (...args: unknown[]) => sendMessage(...args) }));
vi.mock('../events/handlers', () => ({
  startCapture: (guideId: string, isTopFrame: boolean) => startCapture(guideId, isTopFrame),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

async function bootFrame(state: GetStateResponse, onSynced?: (s: GetStateResponse) => void) {
  sendMessage.mockResolvedValue(state);
  const { CaptureSession } = await import('../session');
  const session = new CaptureSession(onSynced);
  await vi.waitFor(() => expect(sendMessage).toHaveBeenCalled());
  await Promise.resolve();
  return session;
}

const recording: GetStateResponse = {
  state: CaptureState.RECORDING,
  stepCount: 2,
  currentGuideId: 'guide-1',
  pauseReason: null,
};

const pausedForBlur: GetStateResponse = {
  state: CaptureState.PAUSED,
  stepCount: 2,
  currentGuideId: 'guide-1',
  pauseReason: 'blur',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CaptureSession boot sync', () => {
  it('starts capturing when the background is RECORDING', async () => {
    const session = await bootFrame(recording);

    expect(startCapture).toHaveBeenCalledWith('guide-1', true);
    expect(session.isActive).toBe(true);
  });

  // The bug in issue 58: a frame that loads during blur mode used to hear
  // RECORDING and start capturing behind a "capture paused" label.
  it('does not start capturing when the background is PAUSED', async () => {
    const session = await bootFrame(pausedForBlur);

    expect(startCapture).not.toHaveBeenCalled();
    expect(session.isActive).toBe(false);
  });

  it('hands the paused state to the caller so the blur overlay can re-open', async () => {
    const onSynced = vi.fn();
    await bootFrame(pausedForBlur, onSynced);

    expect(onSynced).toHaveBeenCalledWith(pausedForBlur);
  });

  it('stays idle when the background is IDLE', async () => {
    const session = await bootFrame({
      state: CaptureState.IDLE,
      stepCount: 0,
      currentGuideId: null,
      pauseReason: null,
    });

    expect(startCapture).not.toHaveBeenCalled();
    expect(session.isActive).toBe(false);
  });
});
