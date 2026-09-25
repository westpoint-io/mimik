// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GetStateResponse } from '@/lib/messaging';
import { CaptureState } from '../machine';

const sendMessage = vi.fn();
const startCapture = vi.fn((_guideId: string, _isTopFrame: boolean) => ({ stop: vi.fn() }));

vi.mock('@/lib/messaging', () => ({ sendMessage: (...args: unknown[]) => sendMessage(...args) }));
vi.mock('../events/handlers', () => ({
  startCapture: (guideId: string, isTopFrame: boolean) => startCapture(guideId, isTopFrame),
}));
const stopAnswering = vi.fn();
const answerChildFrames = vi.fn(() => stopAnswering);
vi.mock('../dom/frame-placement', () => ({ answerChildFrames: () => answerChildFrames() }));
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

describe('CaptureSession answering child frames', () => {
  async function idleSession() {
    vi.useFakeTimers();
    sendMessage.mockReturnValue(new Promise(() => {}));
    const { CaptureSession } = await import('../session');
    return new CaptureSession();
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers nobody before a recording starts', async () => {
    await idleSession();

    expect(answerChildFrames).not.toHaveBeenCalled();
  });

  it('keeps answering past a stop, so a child can still place its last typing step', async () => {
    const session = await idleSession();
    session.start('guide-1');
    session.stop();

    await vi.advanceTimersByTimeAsync(1000);
    expect(stopAnswering).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);
    expect(stopAnswering).toHaveBeenCalledTimes(1);
  });

  it('keeps a single responder across a pause and resume', async () => {
    const session = await idleSession();
    session.start('guide-1');
    session.stop();
    await vi.advanceTimersByTimeAsync(500);
    session.start('guide-1');

    await vi.advanceTimersByTimeAsync(5000);
    expect(answerChildFrames).toHaveBeenCalledTimes(1);
    expect(stopAnswering).not.toHaveBeenCalled();
  });

  it('counts the grace from the last stop, not an earlier one', async () => {
    const session = await idleSession();
    session.start('guide-1');
    session.stop();
    await vi.advanceTimersByTimeAsync(500);
    session.start('guide-1');
    await vi.advanceTimersByTimeAsync(500);
    session.stop();

    await vi.advanceTimersByTimeAsync(1500);
    expect(stopAnswering).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(600);
    expect(stopAnswering).toHaveBeenCalledTimes(1);
  });

  it('stops answering at once when disposed', async () => {
    const session = await idleSession();
    session.start('guide-1');
    session.dispose();
    expect(stopAnswering).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(stopAnswering).toHaveBeenCalledTimes(1);
  });
});
