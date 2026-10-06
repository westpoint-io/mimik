import { logger } from '@mimik/core/logger';
import { CaptureState, type PauseReason } from '@/core/capture/machine';
import { getActiveTab } from '@/lib/browser-api/get-active-tab';
import { getActor } from './actor';
import {
  broadcastAttachCapture,
  broadcastDetachCaptureAndFlush,
  broadcastDismissBlur,
  injectContentScript,
  isInjectableTab,
} from './tab-manager';
import {
  isNarrationLive,
  isNarrationSettling,
  reportNarrationLost,
  stopVoiceNarration,
  whenNarrationSettled,
} from './voice';

const NARRATION_RESTART_ATTEMPTS = 6;

export type NarrationStarter = () => Promise<boolean> | boolean;

let pauseInFlight: Promise<boolean> | null = null;

export async function whenPauseSettled(): Promise<void> {
  await pauseInFlight?.catch(() => false);
}

export function pauseCapture(reason: PauseReason): Promise<boolean> {
  if (pauseInFlight) return Promise.resolve(false);
  if (getActor().getSnapshot().value !== CaptureState.RECORDING) return Promise.resolve(false);
  const pausing = pauseAndStopNarration(reason);
  pauseInFlight = pausing;
  void pausing
    .catch(() => false)
    .finally(() => {
      if (pauseInFlight === pausing) pauseInFlight = null;
    });
  return pausing;
}

async function pauseAndStopNarration(reason: PauseReason): Promise<boolean> {
  const actor = getActor();
  if (actor.getSnapshot().value !== CaptureState.RECORDING) return false;

  const narrationWasLive = (await isNarrationLive()) || isNarrationSettling();
  await broadcastDetachCaptureAndFlush();
  if (actor.getSnapshot().value !== CaptureState.RECORDING) return false;
  actor.send({ type: 'PAUSE_CAPTURE', reason, narrationWasLive });

  const guideId = actor.getSnapshot().context.currentGuideId;
  if (narrationWasLive && guideId) await stopVoiceNarration(guideId);
  return true;
}

export async function resumeCapture(tryStartNarration?: NarrationStarter): Promise<boolean> {
  await whenPauseSettled();
  const actor = getActor();
  if (actor.getSnapshot().value !== CaptureState.PAUSED) return false;

  const narrationWasLive = actor.getSnapshot().context.narrationWasLive === true;
  actor.send({ type: 'RESUME_CAPTURE' });

  const guideId = actor.getSnapshot().context.currentGuideId;
  if (guideId) {
    const activeTab = await getActiveTab();
    if (activeTab?.id && isInjectableTab(activeTab)) await injectContentScript(activeTab.id);
    await broadcastAttachCapture(guideId);
  }

  if (narrationWasLive && tryStartNarration) {
    void restartNarrationOnceTranscriptionSettles(tryStartNarration).catch((error: unknown) =>
      logger.error('voice: narration could not be restarted after the pause', error),
    );
  }
  return true;
}

export async function restartNarrationOnceTranscriptionSettles(tryStartNarration: NarrationStarter): Promise<boolean> {
  for (let attempt = 0; attempt < NARRATION_RESTART_ATTEMPTS; attempt++) {
    if (await tryStartNarration()) return true;
    if (!isNarrationSettling()) {
      reportNarrationLost();
      return false;
    }
    await whenNarrationSettled();
  }
  reportNarrationLost();
  return false;
}

export async function resumeFromPause(tryStartNarration?: NarrationStarter): Promise<boolean> {
  await whenPauseSettled();
  await broadcastDismissBlur();
  return resumeCapture(tryStartNarration);
}
