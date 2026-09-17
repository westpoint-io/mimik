import { CaptureState, type PauseReason } from '@/core/capture/machine';
import { getActiveTab } from '@/lib/browser-api';
import { getActor } from './actor';
import {
  broadcastDismissBlur,
  broadcastStartCapture,
  broadcastStopCaptureAndFlush,
  injectContentScript,
  isInjectableTab,
} from './tab-manager';
import { getVoiceUpdate, stopVoiceNarration } from './voice';

let narrationWasLive = false;

export async function pauseCapture(reason: PauseReason): Promise<boolean> {
  const actor = getActor();
  if (actor.getSnapshot().value !== CaptureState.RECORDING) return false;
  actor.send({ type: 'PAUSE_CAPTURE', reason });

  const guideId = actor.getSnapshot().context.currentGuideId;
  narrationWasLive = getVoiceUpdate().phase === 'recording';
  await broadcastStopCaptureAndFlush();
  if (narrationWasLive && guideId) await stopVoiceNarration(guideId);
  return true;
}

export async function resumeCapture(onNarrationResume?: () => void): Promise<boolean> {
  const actor = getActor();
  if (actor.getSnapshot().value !== CaptureState.PAUSED) return false;
  actor.send({ type: 'RESUME_CAPTURE' });

  const guideId = actor.getSnapshot().context.currentGuideId;
  if (guideId) {
    const activeTab = await getActiveTab();
    if (activeTab?.id && isInjectableTab(activeTab)) await injectContentScript(activeTab.id);
    await broadcastStartCapture(guideId);
  }

  if (narrationWasLive) {
    narrationWasLive = false;
    onNarrationResume?.();
  }
  return true;
}

export async function resumeFromPause(onNarrationResume?: () => void): Promise<boolean> {
  await broadcastDismissBlur();
  return resumeCapture(onNarrationResume);
}
