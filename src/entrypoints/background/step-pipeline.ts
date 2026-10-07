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
import { describeDomStep } from './describe-dom-step';
import { flushNarrationForStep, getVoiceUpdate } from './voice';

async function takeScreenshot(stepId: string, meta: ElementMeta): Promise<string | undefined> {
  try {
    const { targetColor } = await localStorage.get(['targetColor']);
    const dataUrl = await captureVisibleTab('jpeg', 90);
    const blob = await fetch(dataUrl).then((r) => r.blob());
    const img = await createImageBitmap(blob);
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
    return screenshot.id;
  } catch (err) {
    logger.warn('Screenshot capture failed', err);
    return undefined;
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

export async function handleCaptureStep(data: CaptureStepData): Promise<CaptureStepResponse> {
  const snap = getActor().getSnapshot();
  if (snap.value !== CaptureState.RECORDING) return { ignored: true };

  getActor().send({ type: 'USER_ACTION' });

  const stepId = crypto.randomUUID();
  const screenshotId = await takeScreenshot(stepId, data.elementMeta);
  const domContext = data.domContext;

  await writeStep({
    stepId,
    guideId: snap.context.currentGuideId!,
    action: data.action,
    elementMeta: data.elementMeta,
    screenshotId,
    place: { url: snap.context.currentUrl },
    describable: data.action !== 'input' && domContext !== undefined,
    describe: () => (domContext ? describeDomStep(stepId, domContext) : Promise.resolve()),
    narration: getVoiceUpdate().phase === 'recording' ? narration : null,
  });

  return { stepId };
}

export async function handleUpdateInputStep(stepId: string, description: string, inputValue?: string) {
  if (!isRecording()) return;
  await updateStepDescription(stepId, description);
  if (inputValue !== undefined) {
    await updateStepInputValue(stepId, inputValue);
  }
}

export async function handleFinalizeInputStep(
  stepId: string,
  elementMeta: ElementMeta,
  domContext: DOMContext | undefined,
) {
  if (!isLive(getActor().getSnapshot().value)) return;
  const screenshotId = await takeScreenshot(stepId, elementMeta);
  await updateStepCapture(stepId, elementMeta, screenshotId);

  const guideId = (await getStep(stepId))?.guideId;
  if (domContext && guideId) queueDescription(guideId, () => describeDomStep(stepId, domContext));
}
