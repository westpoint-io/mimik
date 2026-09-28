import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { captureMachine } from '@/core/capture/machine';

let actor: ReturnType<typeof createActor<typeof captureMachine>>;

const stopVoiceNarration = vi.fn();
const whenNarrationSettled = vi.fn();
const reportNarrationLost = vi.fn();
let voicePhase = 'idle';
let hostIsRecording = false;

vi.mock('../actor', () => ({ getActor: () => actor, waitUntilReady: () => Promise.resolve() }));
vi.mock('@/lib/browser-api', () => ({ getActiveTab: () => Promise.resolve({ id: 1, url: 'https://app.test' }) }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../tab-manager', () => ({
  broadcastDismissBlur: vi.fn().mockResolvedValue(undefined),
  broadcastStartCapture: vi.fn().mockResolvedValue(undefined),
  broadcastStopCaptureAndFlush: vi.fn().mockResolvedValue(undefined),
  injectContentScript: vi.fn().mockResolvedValue(undefined),
  isInjectableTab: () => true,
}));
vi.mock('../voice', () => ({
  getVoiceUpdate: () => ({ type: 'VOICE_UPDATE', phase: voicePhase }),
  isNarrationLive: () => Promise.resolve(voicePhase === 'recording' || hostIsRecording),
  isNarrationSettling: () => voicePhase === 'transcribing',
  reportNarrationLost: (...args: unknown[]) => reportNarrationLost(...args),
  stopVoiceNarration: (...args: unknown[]) => stopVoiceNarration(...args),
  whenNarrationSettled: (...args: unknown[]) => whenNarrationSettled(...args),
}));

import { pauseCapture, restartNarrationOnceTranscriptionSettles, resumeCapture } from '../pause';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.clearAllMocks();
  voicePhase = 'idle';
  hostIsRecording = false;
  whenNarrationSettled.mockResolvedValue(undefined);
  stopVoiceNarration.mockResolvedValue(undefined);
  actor = createActor(captureMachine);
  actor.start();
  actor.send({ type: 'START_RECORDING', url: 'https://app.test/a' });
});

describe('remembering that narration was on', () => {
  it('records it in the machine context, which survives a worker restart', async () => {
    voicePhase = 'recording';

    await pauseCapture('manual');

    expect(actor.getSnapshot().context.narrationWasLive).toBe(true);
    expect(stopVoiceNarration).toHaveBeenCalledWith(actor.getSnapshot().context.currentGuideId);
  });

  it('asks the microphone host when the in-memory phase was lost to an eviction', async () => {
    voicePhase = 'idle';
    hostIsRecording = true;

    await pauseCapture('manual');

    expect(actor.getSnapshot().context.narrationWasLive).toBe(true);
    expect(stopVoiceNarration).toHaveBeenCalled();
  });

  it('counts a still-transcribing flush from an earlier pause as live', async () => {
    voicePhase = 'transcribing';

    await pauseCapture('manual');

    expect(actor.getSnapshot().context.narrationWasLive).toBe(true);
  });

  it('leaves the flag off when nothing was being narrated', async () => {
    await pauseCapture('manual');

    expect(actor.getSnapshot().context.narrationWasLive).toBe(false);
    expect(stopVoiceNarration).not.toHaveBeenCalled();
  });

  it('clears the flag on resume so a later pause starts clean', async () => {
    voicePhase = 'recording';
    await pauseCapture('manual');
    await resumeCapture(vi.fn().mockResolvedValue(true));

    expect(actor.getSnapshot().context.narrationWasLive).toBe(false);
  });
});

describe('restarting narration after the pause', () => {
  it('answers the panel without waiting for the transcription round-trip', async () => {
    voicePhase = 'recording';
    await pauseCapture('manual');
    voicePhase = 'transcribing';

    let settle = () => {};
    whenNarrationSettled.mockReturnValue(
      new Promise<void>((resolve) => {
        settle = resolve;
      }),
    );

    await expect(resumeCapture(vi.fn().mockResolvedValue(false))).resolves.toBe(true);
    expect(actor.getSnapshot().value).toBe('RECORDING');

    settle();
  });

  it('does not wait on the transcription when the first attempt works', async () => {
    voicePhase = 'recording';
    await pauseCapture('manual');

    const start = vi.fn().mockResolvedValue(true);
    await resumeCapture(start);
    await flush();

    expect(start).toHaveBeenCalledTimes(1);
    expect(whenNarrationSettled).not.toHaveBeenCalled();
  });

  it('does not restart narration that was not running before the pause', async () => {
    await pauseCapture('manual');

    const start = vi.fn().mockResolvedValue(true);
    await resumeCapture(start);
    await flush();

    expect(start).not.toHaveBeenCalled();
  });
});

describe('the retry that waits for the transcription', () => {
  it('tries again once the pending transcription settles', async () => {
    voicePhase = 'transcribing';
    const start = vi.fn().mockImplementation(() => {
      if (start.mock.calls.length > 1) return true;
      return false;
    });
    whenNarrationSettled.mockImplementation(() => {
      voicePhase = 'idle';
      return Promise.resolve();
    });

    await expect(restartNarrationOnceTranscriptionSettles(start)).resolves.toBe(true);

    expect(start).toHaveBeenCalledTimes(2);
    expect(reportNarrationLost).not.toHaveBeenCalled();
  });

  it('keeps waiting while the transcription outlives one settle timeout', async () => {
    voicePhase = 'transcribing';
    const start = vi.fn().mockImplementation(() => start.mock.calls.length > 3);

    await expect(restartNarrationOnceTranscriptionSettles(start)).resolves.toBe(true);

    expect(start).toHaveBeenCalledTimes(4);
    expect(whenNarrationSettled).toHaveBeenCalledTimes(3);
  });

  it('gives up without a second start when the start itself failed', async () => {
    voicePhase = 'idle';
    const start = vi.fn().mockResolvedValue(false);

    await expect(restartNarrationOnceTranscriptionSettles(start)).resolves.toBe(false);

    expect(start).toHaveBeenCalledTimes(1);
    expect(whenNarrationSettled).not.toHaveBeenCalled();
    expect(reportNarrationLost).toHaveBeenCalled();
  });

  it('tells the panel narration is gone when the budget runs out', async () => {
    voicePhase = 'transcribing';
    const start = vi.fn().mockResolvedValue(false);

    await expect(restartNarrationOnceTranscriptionSettles(start)).resolves.toBe(false);

    expect(reportNarrationLost).toHaveBeenCalled();
  });
});
