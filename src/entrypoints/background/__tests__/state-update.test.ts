import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { CaptureState, captureMachine } from '@/core/capture/machine';

const sessionGet = vi.fn();

vi.mock('@/lib/browser-api', () => ({
  sessionStorage: {
    get: (key: string) => sessionGet(key),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

/** A snapshot as the previous build would have persisted it: no pauseReason. */
function legacyRecordingSnapshot() {
  const actor = createActor(captureMachine);
  actor.start();
  actor.send({ type: 'START_RECORDING', url: 'https://example.com' });
  const persisted = JSON.parse(JSON.stringify(actor.getPersistedSnapshot()));
  delete persisted.context.pauseReason;
  return persisted;
}

function pausedSnapshot() {
  const actor = createActor(captureMachine);
  actor.start();
  actor.send({ type: 'START_RECORDING', url: 'https://example.com' });
  actor.send({ type: 'PAUSE_CAPTURE', reason: 'manual' });
  return JSON.parse(JSON.stringify(actor.getPersistedSnapshot()));
}

async function loadActor(snapshot: unknown) {
  vi.resetModules();
  sessionGet.mockResolvedValue({ machineSnapshot: snapshot });
  const mod = await import('../actor');
  await mod.initActor();
  return mod;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getStateUpdate', () => {
  // Reloading the extension mid-session restores a snapshot written by the
  // build before PAUSED existed. Its context has no pauseReason at all, and an
  // `undefined` reaching the panel read as paused — the pill said "capture
  // paused" and the button offered Resume while the machine was RECORDING.
  it('reports a legacy RECORDING snapshot as recording, not paused', async () => {
    const { getStateUpdate } = await loadActor(legacyRecordingSnapshot());

    const update = getStateUpdate();

    expect(update.state).toBe(CaptureState.RECORDING);
    expect(update.pauseReason).toBeNull();
  });

  it('carries the pause reason when the machine really is paused', async () => {
    const { getStateUpdate } = await loadActor(pausedSnapshot());

    const update = getStateUpdate();

    expect(update.state).toBe(CaptureState.PAUSED);
    expect(update.pauseReason).toBe('manual');
  });

  it('starts idle when there is no snapshot to restore', async () => {
    const { getStateUpdate } = await loadActor(undefined);

    const update = getStateUpdate();

    expect(update.state).toBe(CaptureState.IDLE);
    expect(update.pauseReason).toBeNull();
    expect(update.currentGuideId).toBeNull();
  });
});
