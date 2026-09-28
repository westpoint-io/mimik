import { settleDescriptions } from '@mimik/core/capture/ai/settle-descriptions';
import type { CaptureStepData } from '@mimik/core/capture/sink';
import { i18n } from '@mimik/core/env';
import {
  allScreenshotIds,
  deleteStep,
  getStepsForGuide,
  permanentlyDeleteGuide,
  updateGuideDescription,
  updateGuideTitle,
} from '@mimik/core/guides/service';
import { nameGuide } from './ai/name-guide';
import { DesktopCaptureSink } from './capture-sink';

const sink = new DesktopCaptureSink();

allScreenshotIds().then((ids) => window.mimik.screenshots.sweep(ids));

window.mimik.onRequest('mimik:capture:startGuide', () => sink.startGuide());
window.mimik.onRequest('mimik:capture:step', (payload) => sink.captureStep(payload as CaptureStepData));

window.mimik.onRequest('mimik:capture:removeStep', async (payload) => {
  const { guideId, stepId } = payload as { guideId: string; stepId: string };
  await deleteStep(guideId, stepId);
  return true;
});

window.mimik.onRequest('mimik:capture:finishGuide', async (payload) => {
  const guideId = payload as string;
  const steps = await getStepsForGuide(guideId);
  const app = steps.find((step) => step.app?.name)?.app?.name;
  await updateGuideTitle(guideId, app ? i18n.t('desktop.guideInApp', [app]) : i18n.t('background.newGuide'));

  await settleDescriptions(guideId);
  const meta = await nameGuide(guideId);
  if (meta?.title) await updateGuideTitle(guideId, meta.title);
  if (meta?.description) await updateGuideDescription(guideId, meta.description);
  return true;
});

window.mimik.onRequest('mimik:check:cleanup', async (payload) => {
  for (const id of payload as string[]) await permanentlyDeleteGuide(id);
  return true;
});
