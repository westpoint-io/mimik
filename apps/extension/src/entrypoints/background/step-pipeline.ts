import { logger } from '@mimik/core/logger';
import { queueDescription } from '@/core/capture/ai/description-queue';
import type { DOMContext } from '@/core/capture/dom/context';
import { isLive } from '@/core/capture/is-live';
import { CaptureState } from '@/core/capture/machine';
import { deferDescription } from '@/core/capture/voice/deferred-descriptions';
import { type StepNarration, writeStep } from '@/core/capture/write-step';
import {
  getStep,
  saveScreenshot,
  updateStepCapture,
  updateStepDescription,
  updateStepInputValue,
} from '@/core/guides/service';
import type { ElementMeta } from '@/core/guides/types';
import { screenshotForElement } from '@/core/screenshot/record';
import { captureVisibleTab } from '@/lib/browser-api/capture-visible-tab';
import { localStorage } from '@/lib/browser-api/local-storage';
import type { CaptureStepData, CaptureStepResponse } from '@/lib/messaging';
import { getActor } from './actor';
import { aimFor } from './aim-for';
import { withCardHidden } from './card';
import { cardFeed } from './card-feed';
import { describeDomStep } from './describe-dom-step';
import { flushNarrationForStep, getVoiceUpdate } from './voice';

interface Shot {
  id?: string;
  src: string;
}

async function takeScreenshot(stepId: string, meta: ElementMeta, tabId?: number): Promise<Shot> {
  try {
    const { targetColor } = await localStorage.get(['targetColor']);
    cardFeed.setBusy(true);
    cardFeed.setProgress(90, 250);
    const dataUrl = await withCardHidden(tabId, () => captureVisibleTab('jpeg', 90));
    const blob = await fetch(dataUrl).then((r) => r.blob());
    const img = await createImageBitmap(blob);
    cardFeed.setPrint({ src: dataUrl, aim: aimFor(meta, img) });
    const screenshot = screenshotForElement(
      {
        id: crypto.randomUUID(),
        stepId,
        blob,
        mimeType: 'image/jpeg',
        width: img.width,
        height: img.height,
        targetColor: targetColor as string,
      },
      meta,
    );
    img.close();
    await saveScreenshot(screenshot);
    return { id: screenshot.id, src: dataUrl };
  } catch (err) {
    logger.warn('Screenshot capture failed', err);
    return { src: '' };
  }
}

function isRecording(): boolean {
  return getActor().getSnapshot().value === CaptureState.RECORDING;
}

const narration: StepNarration = {
  take(guideId, stepId, timestamp, describe) {
    if (describe) deferDescription(guideId, stepId, describe);
    void flushNarrationForStep(guideId, stepId, timestamp);
  },
};

export async function handleCaptureStep(data: CaptureStepData, tabId?: number): Promise<CaptureStepResponse> {
  const snap = getActor().getSnapshot();
  if (snap.value !== CaptureState.RECORDING) return { ignored: true };

  getActor().send({ type: 'USER_ACTION' });

  const stepId = crypto.randomUUID();
  const shot = await takeScreenshot(stepId, data.elementMeta, tabId);
  const domContext = data.domContext;

  try {
    const written = await writeStep({
      stepId,
      guideId: snap.context.currentGuideId!,
      action: data.action,
      elementMeta: data.elementMeta,
      screenshotId: shot.id,
      place: { url: snap.context.currentUrl },
      describable: data.action !== 'input' && domContext !== undefined,
      describe: () => (domContext ? describeDomStep(stepId, domContext) : Promise.resolve()),
      narration: getVoiceUpdate().phase === 'recording' ? narration : null,
    });
    cardFeed.add({
      id: stepId,
      title: written.description,
      action: data.action,
      src: shot.src,
      source: 'heuristic',
      pending: written.pending,
      url: snap.context.currentUrl ?? '',
    });
  } finally {
    cardFeed.setBusy(false);
  }

  return { stepId };
}

export async function handleUpdateInputStep(stepId: string, description: string, inputValue?: string) {
  if (!isRecording()) return;
  await updateStepDescription(stepId, description);
  cardFeed.update(stepId, { title: description });
  if (inputValue !== undefined) {
    await updateStepInputValue(stepId, inputValue);
  }
}

export async function handleFinalizeInputStep(
  stepId: string,
  elementMeta: ElementMeta,
  domContext: DOMContext | undefined,
  typed: boolean,
  tabId?: number,
) {
  if (!isLive(getActor().getSnapshot().value)) return;
  const shot = await takeScreenshot(stepId, elementMeta, tabId);
  try {
    await updateStepCapture(stepId, elementMeta, shot.id, typed ? undefined : 'click');
    if (shot.src) cardFeed.update(stepId, { src: shot.src });
  } finally {
    cardFeed.setBusy(false);
  }

  const guideId = (await getStep(stepId))?.guideId;
  if (domContext && guideId) queueDescription(guideId, () => describeDomStep(stepId, domContext));
}
