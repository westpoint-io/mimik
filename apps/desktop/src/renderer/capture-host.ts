import { finishGuide } from '@mimik/core/capture/ai/finish-guide';
import { mergeRecording } from '@mimik/core/capture/ai/merge-recording';
import { CaptureState } from '@mimik/core/capture/machine';
import { i18n, localStorage } from '@mimik/core/env';
import { getMostCommonApp } from '@mimik/core/guides/most-common-app';
import {
  allScreenshotIds,
  deleteStep,
  getStepsForGuide,
  permanentlyDeleteGuide,
  softDeleteGuide,
} from '@mimik/core/guides/service';
import { DesktopCaptureSink } from './capture-sink';
import { desktopNarration as narration } from './desktop-narration';

const sink = new DesktopCaptureSink(narration);
let narratingBeforePause = false;

allScreenshotIds().then((ids) => window.mimik.screenshots.sweep(ids));

window.mimik.onRequest('mimik:capture:createGuide', (payload) => sink.createGuide(payload));
window.mimik.onRequest('mimik:capture:captureStep', (payload) => sink.captureStep(payload));

window.mimik.capture.onStateUpdate(async ({ command, state, currentGuideId }) => {
  if (command === 'narration:start' || command === 'narration:stop') {
    await localStorage.set({ voiceEnabled: command === 'narration:start' });
  }
  if (!currentGuideId) return;
  const recording = state === CaptureState.RECORDING;
  if (
    command === 'start' ||
    (command === 'resume' && narratingBeforePause) ||
    (command === 'narration:start' && recording)
  ) {
    narration.start(currentGuideId);
  } else if (command === 'pause') {
    narratingBeforePause = narration.update.phase === 'recording';
    narration.stop();
  } else if (command === 'narration:stop') narration.turnOff();
});

window.mimik.onRequest('mimik:capture:deleteStep', async (payload) => {
  const { guideId, stepId } = payload;
  await deleteStep(guideId, stepId);
  return true;
});

async function appTitle(guideId: string): Promise<string> {
  const app = getMostCommonApp(await getStepsForGuide(guideId))?.name;
  return app ? i18n.t('desktop.guideInApp', [app]) : i18n.t('background.newGuide');
}

window.mimik.onRequest('mimik:capture:finishGuide', async (payload) => {
  await finishGuide(payload, { fallbackTitle: appTitle, settleNarration: () => narration.settle() });
  return true;
});

window.mimik.onRequest('mimik:capture:discardRecording', async (payload) => {
  const { guideId, staging } = payload;
  narration.turnOff();
  if (staging) await permanentlyDeleteGuide(guideId);
  else await softDeleteGuide(guideId);
  return true;
});

window.mimik.onRequest('mimik:capture:mergeGuideInto', async (payload) => {
  const { guideId, insertTargetGuideId, insertAtIndex } = payload;
  await mergeRecording(guideId, { insertTargetGuideId, insertAtIndex }, () => narration.settle());
  return true;
});

window.mimik.onRequest('mimik:check:cleanup', async (payload) => {
  for (const id of payload) await permanentlyDeleteGuide(id);
  return true;
});
