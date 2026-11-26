import { CaptureState, captureMachine } from '@mimik/core/capture/machine';
import { describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { followAccessibility } from '../capture/follow-accessibility';

const MARKER = '/tmp/mimik/accessibility-on';

function setup() {
  const calls: string[] = [];
  const native = {
    turnOnAccessibility: vi.fn(async (marker: string) => {
      calls.push(`on ${marker}`);
    }),
    restoreAccessibility: vi.fn((marker: string) => {
      calls.push(`restore ${marker}`);
    }),
    releaseWebContent: vi.fn(() => {
      calls.push('release');
    }),
    wakeApps: vi.fn(() => {
      calls.push('wake');
    }),
  };
  const capture = createActor(captureMachine).start();
  const leave = followAccessibility(capture, native, MARKER);
  return { calls, capture, leave };
}

describe('followAccessibility', () => {
  it('puts back a bus a crashed run left on, before anything else', () => {
    const { calls } = setup();

    expect(calls).toEqual([`restore ${MARKER}`]);
  });

  it('turns the bus on when the card is armed and wakes apps once it is on', async () => {
    const { calls, capture } = setup();

    capture.send({ type: 'ARM' });
    await vi.waitFor(() => expect(calls).toContain('wake'));

    expect(calls).toEqual([`restore ${MARKER}`, `on ${MARKER}`, 'wake']);
  });

  it('turns it on once for a whole recording and puts it back when it ends', async () => {
    const { calls, capture } = setup();

    capture.send({ type: 'ARM' });
    capture.send({ type: 'START_RECORDING' });
    await vi.waitFor(() => expect(calls).toContain('wake'));
    capture.send({ type: 'STOP_RECORDING' });

    expect(calls.filter((call) => call.startsWith('on'))).toHaveLength(1);
    expect(calls.slice(-2)).toEqual(['release', `restore ${MARKER}`]);
    expect(capture.getSnapshot().value).toBe(CaptureState.IDLE);
  });

  it('puts it back when the armed card is dismissed without recording', () => {
    const { calls, capture } = setup();

    capture.send({ type: 'ARM' });
    capture.send({ type: 'DISARM' });

    expect(calls.slice(-2)).toEqual(['release', `restore ${MARKER}`]);
  });

  it('puts it back on quit during a recording, and only once', () => {
    const { calls, capture, leave } = setup();

    capture.send({ type: 'ARM' });
    capture.send({ type: 'START_RECORDING' });
    leave();
    leave();

    expect(calls.filter((call) => call.startsWith('restore'))).toHaveLength(2);
  });

  it('leaves the bus alone on quit when nothing is being recorded', () => {
    const { calls, leave } = setup();

    leave();

    expect(calls).toEqual([`restore ${MARKER}`]);
  });
});
