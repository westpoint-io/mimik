import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { CaptureState, captureMachine } from '@/core/capture/machine';

let actor: ReturnType<typeof createActor<typeof captureMachine>>;
let voicePhase = 'idle';
let activeTab: { id?: number; url?: string } | undefined;

/** Ordering matters more than call counts here, so record a sequence. */
const { calls, record } = vi.hoisted(() => {
  const seq: string[] = [];
  return {
    calls: seq,
    record: (name: string) => () => {
      seq.push(name);
      return Promise.resolve();
    },
  };
});

vi.mock('../actor', () => ({ getActor: () => actor }));

vi.mock('../tab-manager', () => ({
  broadcastDismissBlur: record('dismissBlur'),
  broadcastClearBlur: record('clearBlur'),
  broadcastStopCaptureAndFlush: record('flush'),
  broadcastStartCapture: record('startCapture'),
  injectContentScript: record('inject'),
  isInjectableTab: (tab: { url?: string }) => !!tab.url?.startsWith('https://'),
}));

vi.mock('../voice', () => ({
  getVoiceUpdate: () => ({ type: 'VOICE_UPDATE', phase: voicePhase }),
  stopVoiceNarration: record('stopNarration'),
}));

vi.mock('@/lib/browser-api', () => ({ getActiveTab: () => Promise.resolve(activeTab) }));

import { pauseCapture, resumeCapture, resumeFromPause } from '../pause';

beforeEach(() => {
  calls.length = 0;
  voicePhase = 'idle';
  activeTab = { id: 7, url: 'https://app.test' };
  actor = createActor(captureMachine);
  actor.start();
  actor.send({ type: 'START_RECORDING', url: 'https://app.test' });
});

describe('pauseCapture', () => {
  it('pauses the machine with its reason and flushes the frames', async () => {
    await expect(pauseCapture('manual')).resolves.toBe(true);

    expect(actor.getSnapshot().value).toBe(CaptureState.PAUSED);
    expect(actor.getSnapshot().context.pauseReason).toBe('manual');
    expect(calls).toContain('flush');
  });

  it('refuses when nothing is recording, without touching the frames', async () => {
    actor.send({ type: 'STOP_RECORDING' });

    await expect(pauseCapture('manual')).resolves.toBe(false);
    expect(calls).toEqual([]);
  });

  it('refuses a second pause', async () => {
    await pauseCapture('manual');
    calls.length = 0;

    await expect(pauseCapture('blur')).resolves.toBe(false);
    expect(actor.getSnapshot().context.pauseReason).toBe('manual');
    expect(calls).toEqual([]);
  });

  // Speech during a pause would otherwise be transcribed and attributed to the
  // step captured after the resume.
  it('stops narration when it was live', async () => {
    voicePhase = 'recording';

    await pauseCapture('blur');

    expect(calls).toContain('stopNarration');
  });

  it('leaves narration alone when it was not running', async () => {
    await pauseCapture('manual');

    expect(calls).not.toContain('stopNarration');
  });

  // The flush is what lets a typing session's final screenshot land, so it must
  // finish before the caller opens the blur overlay over the page.
  it('flushes before returning', async () => {
    await pauseCapture('blur');

    expect(calls).toContain('flush');
    expect(calls.indexOf('flush')).toBeGreaterThanOrEqual(0);
  });
});

describe('resumeCapture', () => {
  it('returns to RECORDING and clears the reason', async () => {
    await pauseCapture('manual');

    await expect(resumeCapture()).resolves.toBe(true);

    expect(actor.getSnapshot().value).toBe(CaptureState.RECORDING);
    expect(actor.getSnapshot().context.pauseReason).toBeNull();
  });

  it('refuses when the recording is not paused', async () => {
    await expect(resumeCapture()).resolves.toBe(false);
    expect(calls).toEqual([]);
  });

  it('keeps the same guide, so steps continue in one recording', async () => {
    const guideId = actor.getSnapshot().context.currentGuideId;
    await pauseCapture('manual');

    await resumeCapture();

    expect(actor.getSnapshot().context.currentGuideId).toBe(guideId);
  });

  // A tab opened during the pause was skipped by the navigation listeners, so
  // it has no content script to answer START_CAPTURE.
  it('injects the active tab before restarting capture', async () => {
    await pauseCapture('manual');
    calls.length = 0;

    await resumeCapture();

    expect(calls).toEqual(['inject', 'startCapture']);
  });

  it('skips injection on a tab that cannot take a content script', async () => {
    await pauseCapture('manual');
    activeTab = { id: 9, url: 'chrome://extensions' };
    calls.length = 0;

    await resumeCapture();

    expect(calls).toEqual(['startCapture']);
  });

  it('restarts narration only when the pause stopped it', async () => {
    voicePhase = 'recording';
    await pauseCapture('manual');
    const onResume = vi.fn();

    await resumeCapture(onResume);

    expect(onResume).toHaveBeenCalledOnce();
  });

  it('does not restart narration the user never had on', async () => {
    await pauseCapture('manual');
    const onResume = vi.fn();

    await resumeCapture(onResume);

    expect(onResume).not.toHaveBeenCalled();
  });

  it('does not restart narration twice across two pause cycles', async () => {
    voicePhase = 'recording';
    await pauseCapture('manual');
    const first = vi.fn();
    await resumeCapture(first);
    expect(first).toHaveBeenCalledOnce();

    voicePhase = 'idle';
    await pauseCapture('manual');
    const second = vi.fn();
    await resumeCapture(second);

    expect(second).not.toHaveBeenCalled();
  });
});

describe('resumeFromPause', () => {
  // Clearing here instead of dismissing would wipe the masks the user just
  // picked, leaving every screenshot after the resume unredacted.
  it('dismisses the overlay and never clears the masks', async () => {
    await pauseCapture('blur');
    calls.length = 0;

    await expect(resumeFromPause()).resolves.toBe(true);

    expect(calls).toContain('dismissBlur');
    expect(calls).not.toContain('clearBlur');
  });

  it('dismisses before unpausing, so no frame captures with the panel up', async () => {
    await pauseCapture('manual');
    calls.length = 0;

    await resumeFromPause();

    expect(calls.indexOf('dismissBlur')).toBeLessThan(calls.indexOf('startCapture'));
  });

  it('still dismisses when there is nothing to resume', async () => {
    calls.length = 0;

    await expect(resumeFromPause()).resolves.toBe(false);

    expect(calls).toEqual(['dismissBlur']);
  });
});
