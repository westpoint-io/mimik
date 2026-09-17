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

/** Whether narration was live when the recording was paused, so resume can
 *  put the microphone back the way the user left it. */
let narrationWasLive = false;

/**
 * Moves RECORDING → PAUSED, then stops every frame and waits for them to drain.
 * Returns false when there is nothing to pause, so a caller never reports a
 * pause the machine did not take.
 *
 * The microphone is part of what "paused" promises. Leaving it live would send
 * whatever is said during the pause to the transcription provider and attribute
 * it to the step captured after the resume — exactly the opposite of what
 * someone pausing over sensitive data expects. Stopping narration here also
 * transcribes what was said *before* the pause, which does belong to the steps
 * already recorded.
 */
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

/** Moves PAUSED → RECORDING and puts the live frames back to work. */
export async function resumeCapture(onNarrationResume?: () => void): Promise<boolean> {
  const actor = getActor();
  if (actor.getSnapshot().value !== CaptureState.PAUSED) return false;
  actor.send({ type: 'RESUME_CAPTURE' });

  const guideId = actor.getSnapshot().context.currentGuideId;
  if (guideId) {
    // A tab opened or activated during the pause was skipped by the navigation
    // listeners, so it may have no content script to answer START_CAPTURE.
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

/**
 * The way back from any pause, however it was entered.
 *
 * Dismissing rather than clearing is the whole point of having both messages:
 * the masks the user just picked have to survive, or the screenshots taken
 * after the resume are unredacted. Only the end of a recording clears them.
 * Both the blur exit and the panel's Resume come through here so there is one
 * place for that decision rather than two that can drift apart.
 */
export async function resumeFromPause(onNarrationResume?: () => void): Promise<boolean> {
  await broadcastDismissBlur();
  return resumeCapture(onNarrationResume);
}
