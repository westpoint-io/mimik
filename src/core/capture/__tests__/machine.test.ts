import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import { CaptureState, captureMachine } from '../machine';

function startActor() {
  const actor = createActor(captureMachine);
  actor.start();
  return actor;
}

describe('captureMachine', () => {
  it('starts in IDLE state', () => {
    const actor = startActor();
    expect(actor.getSnapshot().value).toBe(CaptureState.IDLE);
  });

  it('transitions IDLE → RECORDING on START_RECORDING', () => {
    const actor = startActor();
    actor.send({ type: 'START_RECORDING', url: 'https://example.com' });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe(CaptureState.RECORDING);
    expect(snap.context.currentGuideId).toBeTypeOf('string');
    expect(snap.context.currentGuideId).toHaveLength(36);
    expect(snap.context.currentUrl).toBe('https://example.com');
    expect(snap.context.stepCount).toBe(0);
  });

  it('transitions RECORDING → IDLE on STOP_RECORDING and resets context', () => {
    const actor = startActor();
    actor.send({ type: 'START_RECORDING', url: 'https://example.com' });
    actor.send({ type: 'USER_ACTION' });
    actor.send({ type: 'STOP_RECORDING' });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe(CaptureState.IDLE);
    expect(snap.context.currentGuideId).toBeNull();
    expect(snap.context.stepCount).toBe(0);
    expect(snap.context.currentUrl).toBe('');
  });

  it('increments stepCount on USER_ACTION while RECORDING', () => {
    const actor = startActor();
    actor.send({ type: 'START_RECORDING', url: 'https://example.com' });

    actor.send({ type: 'USER_ACTION' });
    expect(actor.getSnapshot().context.stepCount).toBe(1);

    actor.send({ type: 'USER_ACTION' });
    expect(actor.getSnapshot().context.stepCount).toBe(2);

    actor.send({ type: 'USER_ACTION' });
    expect(actor.getSnapshot().context.stepCount).toBe(3);
  });

  it('stays IDLE when STOP_RECORDING is sent in IDLE state', () => {
    const actor = startActor();
    actor.send({ type: 'STOP_RECORDING' });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe(CaptureState.IDLE);
    expect(snap.context.currentGuideId).toBeNull();
  });

  it('stays RECORDING when START_RECORDING is sent while already RECORDING', () => {
    const actor = startActor();
    actor.send({ type: 'START_RECORDING', url: 'https://first.com' });
    const guideId = actor.getSnapshot().context.currentGuideId;

    actor.send({ type: 'START_RECORDING', url: 'https://second.com' });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe(CaptureState.RECORDING);
    expect(snap.context.currentGuideId).toBe(guideId);
    expect(snap.context.currentUrl).toBe('https://first.com');
  });

  it('sets currentUrl on START_RECORDING', () => {
    const actor = startActor();
    actor.send({ type: 'START_RECORDING', url: 'https://app.dev/dashboard' });
    expect(actor.getSnapshot().context.currentUrl).toBe('https://app.dev/dashboard');
  });

  it('defaults currentUrl to empty string when url is omitted', () => {
    const actor = startActor();
    actor.send({ type: 'START_RECORDING' });
    expect(actor.getSnapshot().context.currentUrl).toBe('');
  });

  it('updates currentUrl on URL_CHANGED while RECORDING', () => {
    const actor = startActor();
    actor.send({ type: 'START_RECORDING', url: 'https://example.com/page1' });

    actor.send({ type: 'URL_CHANGED', url: 'https://example.com/page2' });
    expect(actor.getSnapshot().context.currentUrl).toBe('https://example.com/page2');

    actor.send({ type: 'URL_CHANGED', url: 'https://example.com/page3' });
    expect(actor.getSnapshot().context.currentUrl).toBe('https://example.com/page3');
  });

  it('ignores URL_CHANGED in IDLE state', () => {
    const actor = startActor();
    actor.send({ type: 'URL_CHANGED', url: 'https://example.com' });
    expect(actor.getSnapshot().context.currentUrl).toBe('');
  });

  it('generates a unique guideId for each recording session', () => {
    const actor = startActor();

    actor.send({ type: 'START_RECORDING' });
    const firstId = actor.getSnapshot().context.currentGuideId;

    actor.send({ type: 'STOP_RECORDING' });
    actor.send({ type: 'START_RECORDING' });
    const secondId = actor.getSnapshot().context.currentGuideId;

    expect(firstId).not.toBe(secondId);
  });

  it('transitions RECORDING → PAUSED on PAUSE_CAPTURE and records the reason', () => {
    const actor = startActor();
    actor.send({ type: 'START_RECORDING', url: 'https://example.com' });
    actor.send({ type: 'PAUSE_CAPTURE', reason: 'blur' });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe(CaptureState.PAUSED);
    expect(snap.context.pauseReason).toBe('blur');
    expect(snap.context.currentGuideId).toBeTypeOf('string');
  });

  it('transitions PAUSED → RECORDING on RESUME_CAPTURE and keeps the guide', () => {
    const actor = startActor();
    actor.send({ type: 'START_RECORDING', url: 'https://example.com' });
    const guideId = actor.getSnapshot().context.currentGuideId;
    actor.send({ type: 'USER_ACTION' });
    actor.send({ type: 'PAUSE_CAPTURE', reason: 'manual' });
    actor.send({ type: 'RESUME_CAPTURE' });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe(CaptureState.RECORDING);
    expect(snap.context.pauseReason).toBeNull();
    expect(snap.context.currentGuideId).toBe(guideId);
    expect(snap.context.stepCount).toBe(1);
  });

  it('ignores USER_ACTION while PAUSED', () => {
    const actor = startActor();
    actor.send({ type: 'START_RECORDING', url: 'https://example.com' });
    actor.send({ type: 'USER_ACTION' });
    actor.send({ type: 'PAUSE_CAPTURE', reason: 'blur' });

    actor.send({ type: 'USER_ACTION' });
    actor.send({ type: 'USER_ACTION' });

    expect(actor.getSnapshot().context.stepCount).toBe(1);
    expect(actor.getSnapshot().value).toBe(CaptureState.PAUSED);
  });

  it('transitions PAUSED → IDLE on STOP_RECORDING and resets context', () => {
    const actor = startActor();
    actor.send({ type: 'START_RECORDING', url: 'https://example.com' });
    actor.send({ type: 'PAUSE_CAPTURE', reason: 'blur' });
    actor.send({ type: 'STOP_RECORDING' });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe(CaptureState.IDLE);
    expect(snap.context.currentGuideId).toBeNull();
    expect(snap.context.pauseReason).toBeNull();
    expect(snap.context.currentUrl).toBe('');
  });

  it('tracks URL_CHANGED while PAUSED so navigation is not lost', () => {
    const actor = startActor();
    actor.send({ type: 'START_RECORDING', url: 'https://example.com/a' });
    actor.send({ type: 'PAUSE_CAPTURE', reason: 'blur' });
    actor.send({ type: 'URL_CHANGED', url: 'https://example.com/b' });

    expect(actor.getSnapshot().context.currentUrl).toBe('https://example.com/b');
    expect(actor.getSnapshot().value).toBe(CaptureState.PAUSED);
  });

  it('ignores PAUSE_CAPTURE in IDLE', () => {
    const actor = startActor();
    actor.send({ type: 'PAUSE_CAPTURE', reason: 'manual' });

    expect(actor.getSnapshot().value).toBe(CaptureState.IDLE);
    expect(actor.getSnapshot().context.pauseReason).toBeNull();
  });

  it('ignores START_RECORDING while PAUSED', () => {
    const actor = startActor();
    actor.send({ type: 'START_RECORDING', url: 'https://first.com' });
    const guideId = actor.getSnapshot().context.currentGuideId;
    actor.send({ type: 'PAUSE_CAPTURE', reason: 'blur' });

    actor.send({ type: 'START_RECORDING', url: 'https://second.com' });

    const snap = actor.getSnapshot();
    expect(snap.value).toBe(CaptureState.PAUSED);
    expect(snap.context.currentGuideId).toBe(guideId);
  });

  it('survives a persisted snapshot round trip while PAUSED', () => {
    const actor = startActor();
    actor.send({ type: 'START_RECORDING', url: 'https://example.com' });
    actor.send({ type: 'PAUSE_CAPTURE', reason: 'blur' });
    const guideId = actor.getSnapshot().context.currentGuideId;

    const restored = createActor(captureMachine, { snapshot: actor.getPersistedSnapshot() });
    restored.start();

    const snap = restored.getSnapshot();
    expect(snap.value).toBe(CaptureState.PAUSED);
    expect(snap.context.pauseReason).toBe('blur');
    expect(snap.context.currentGuideId).toBe(guideId);
  });
});
