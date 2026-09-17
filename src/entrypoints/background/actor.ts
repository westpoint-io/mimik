import { createActor } from 'xstate';
import { type CaptureSnapshot, type CaptureStateValue, captureMachine } from '@/core/capture/machine';
import { sessionStorage } from '@/lib/browser-api';
import { logger } from '@/lib/logger';
import type { PanelStateUpdate } from '@/lib/port';
import type { ActorRef } from './types';

const STORAGE_KEY = 'machineSnapshot';

let actor: ActorRef;
let readyResolve!: () => void;

const readyPromise = new Promise<void>((resolve) => {
  readyResolve = resolve;
});

export function waitUntilReady(): Promise<void> {
  return readyPromise;
}

export function getActor(): ActorRef {
  return actor;
}

export async function initActor(): Promise<void> {
  try {
    const result = await sessionStorage.get(STORAGE_KEY);
    const snapshot = (result[STORAGE_KEY] as CaptureSnapshot) ?? undefined;
    actor = createActor(captureMachine, { snapshot });
    actor.start();
    logger.info('Actor restored from snapshot → state:', actor.getSnapshot().value);
  } catch (err) {
    logger.warn('Failed to restore snapshot, starting fresh', err);
    await sessionStorage.remove(STORAGE_KEY);
    actor = createActor(captureMachine);
    actor.start();
  }

  actor.subscribe(() => {
    const snap = actor.getSnapshot();
    logger.debug('State transition →', snap.value, '| steps:', snap.context.stepCount);
    sessionStorage.set({ [STORAGE_KEY]: actor.getPersistedSnapshot() });
  });

  readyResolve();
  logger.info('Actor ready');
}

export function getStateUpdate(): PanelStateUpdate {
  const snap = actor.getSnapshot();
  return {
    type: 'STATE_UPDATE',
    state: snap.value as CaptureStateValue,
    stepCount: snap.context.stepCount,
    currentGuideId: snap.context.currentGuideId,
    pauseReason: snap.context.pauseReason ?? null,
  };
}

export function initActorFallback(): void {
  logger.error(' initActor failed, starting fresh');
  actor = createActor(captureMachine);
  actor.start();
  readyResolve();
}
