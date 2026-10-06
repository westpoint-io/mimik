import { resolveGuideMetaInputs } from '@mimik/core/capture/ai/guide-description';
import { settleDescriptions } from '@mimik/core/capture/ai/settle-descriptions';
import type { CaptureStepData } from '@mimik/core/capture/sink';
import { i18n, localStorage } from '@mimik/core/env';
import { getMostCommonApp } from '@mimik/core/guides/most-common-app';
import {
  allScreenshotIds,
  createSnapshot,
  deleteStep,
  getStepsForGuide,
  mergeGuideInto,
  permanentlyDeleteGuide,
  updateGuideDescription,
  updateGuideTitle,
} from '@mimik/core/guides/service';
import { nameGuide } from './ai/name-guide';
import { DesktopCaptureSink } from './capture-sink';
import { DesktopNarration } from './narration';

const narration = new DesktopNarration();
const sink = new DesktopCaptureSink(narration);

allScreenshotIds().then((ids) => window.mimik.screenshots.sweep(ids));

window.mimik.onRequest('mimik:capture:startGuide', (payload) => sink.startGuide(payload === true));
window.mimik.onRequest('mimik:capture:step', (payload) => sink.captureStep(payload as CaptureStepData));

window.mimik.capture.onCommand(async (command, state, _region, id) => {
  if (command === 'mic:on' || command === 'mic:off') await localStorage.set({ voiceEnabled: command === 'mic:on' });
  if (!id) return;
  if (command === 'start' || command === 'resume' || (command === 'mic:on' && state === 'recording')) {
    narration.listen(id);
  } else if (command === 'pause' || command === 'mic:off') narration.cut();
  else if (command === 'cancel') narration.abort();
});

window.mimik.onRequest('mimik:capture:removeStep', async (payload) => {
  const { guideId, stepId } = payload as { guideId: string; stepId: string };
  await deleteStep(guideId, stepId);
  return true;
});

window.mimik.onRequest('mimik:capture:finishGuide', async (payload) => {
  const guideId = payload as string;
  await narration.finish();
  const steps = await getStepsForGuide(guideId);
  if (steps.length === 0) return true;
  const app = getMostCommonApp(steps)?.name;
  const fallback = app ? i18n.t('desktop.guideInApp', [app]) : i18n.t('background.newGuide');
  if (!(await resolveGuideMetaInputs(guideId)).ok) {
    await updateGuideTitle(guideId, fallback);
    return true;
  }

  await settleDescriptions(guideId);
  const meta = await nameGuide(guideId);
  await updateGuideTitle(guideId, meta?.title || fallback);
  if (meta?.description) await updateGuideDescription(guideId, meta.description);
  return true;
});

window.mimik.onRequest('mimik:capture:insertGuide', async (payload) => {
  const { guideId, targetGuideId, atIndex } = payload as { guideId: string; targetGuideId: string; atIndex: number };
  await narration.finish();
  await settleDescriptions(guideId);
  await createSnapshot(targetGuideId);
  await mergeGuideInto(guideId, targetGuideId, atIndex);
  return true;
});

window.mimik.onRequest('mimik:check:cleanup', async (payload) => {
  for (const id of payload as string[]) await permanentlyDeleteGuide(id);
  return true;
});
