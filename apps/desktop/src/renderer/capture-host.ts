import { finishGuide } from '@mimik/core/capture/ai/finish-guide';
import { mergeRecording } from '@mimik/core/capture/ai/merge-recording';
import { CaptureState } from '@mimik/core/capture/machine';
import type { CaptureStepData } from '@mimik/core/capture/sink';
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

window.mimik.onRequest('mimik:capture:createGuide', (payload) =>
  sink.createGuide(payload as { guideId?: string; staging?: boolean }),
);
window.mimik.onRequest('mimik:capture:captureStep', (payload) => sink.captureStep(payload as CaptureStepData));

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
  } else if (command === 'narration:stop') narration.abort();
});

window.mimik.onRequest('mimik:capture:deleteStep', async (payload) => {
  const { guideId, stepId } = payload as { guideId: string; stepId: string };
  await deleteStep(guideId, stepId);
  return true;
});

async function appTitle(guideId: string): Promise<string> {
  const app = getMostCommonApp(await getStepsForGuide(guideId))?.name;
  return app ? i18n.t('desktop.guideInApp', [app]) : i18n.t('background.newGuide');
}

window.mimik.onRequest('mimik:capture:finishGuide', async (payload) => {
  await finishGuide(payload as string, { fallbackTitle: appTitle, settleNarration: () => narration.settle() });
  return true;
});

window.mimik.onRequest('mimik:capture:discardRecording', async (payload) => {
  const { guideId, staging } = payload as { guideId: string; staging: boolean };
  narration.abort();
  if (staging) await permanentlyDeleteGuide(guideId);
  else await softDeleteGuide(guideId);
  return true;
});

window.mimik.onRequest('mimik:capture:mergeGuideInto', async (payload) => {
  const { guideId, insertTargetGuideId, insertAtIndex } = payload as {
    guideId: string;
    insertTargetGuideId: string;
    insertAtIndex: number;
  };
  await mergeRecording(guideId, { insertTargetGuideId, insertAtIndex }, () => narration.settle());
  return true;
});

window.mimik.onRequest('mimik:check:cleanup', async (payload) => {
  for (const id of payload as string[]) await permanentlyDeleteGuide(id);
  return true;
});
