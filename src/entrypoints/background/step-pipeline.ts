import { logger } from '@mimik/ui/lib/logger';
import { AI_KEY_SETTINGS, resolveAiKey } from '@/core/capture/ai/keys';
import type { DOMContext } from '@/core/capture/dom/context';
import { CaptureState } from '@/core/capture/machine';
import { buildFallbackDescription } from '@/core/capture/step-description';
import {
  addStepToGuide,
  clearStepAiPending,
  createStep,
  getStep,
  saveScreenshot,
  updateStepCapture,
  updateStepDescription,
  updateStepInputValue,
} from '@/core/guides/service';
import type { ElementMeta } from '@/core/guides/types';
import { screenshotForElement } from '@/core/screenshot/record';
import { captureVisibleTab, localStorage } from '@/lib/browser-api';
import type { CaptureStepData, CaptureStepResponse } from '@/lib/messaging';
import { getActor } from './actor';
import { generateAiDescription } from './ai-description';
import { deferDescription, shouldQueueAiDescription } from './deferred-descriptions';
import { queueDescription } from './description-queue';
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

async function tryAIDescription(stepId: string, domContext: DOMContext) {
  if (!resolveAiKey(await localStorage.get([...AI_KEY_SETTINGS])).apiKey) return;
  try {
    await clearStepAiPending(stepId, await generateAiDescription(domContext));
  } catch (err) {
    await clearStepAiPending(stepId);
    throw err;
  }
}

export async function handleCaptureStep(data: CaptureStepData): Promise<CaptureStepResponse> {
  const snap = getActor().getSnapshot();
  if (snap.value !== CaptureState.RECORDING) return { ignored: true };

  const stepIndex = snap.context.stepCount;
  getActor().send({ type: 'USER_ACTION' });

  const guideId = snap.context.currentGuideId!;
  const stepId = crypto.randomUUID();

  const screenshotId = await takeScreenshot(stepId, data.elementMeta);

  const narrationCapturing = getVoiceUpdate().phase === 'recording';
  const hasAiKey = !!resolveAiKey(await localStorage.get([...AI_KEY_SETTINGS])).apiKey;
  const willUseAI = shouldQueueAiDescription({
    action: data.action,
    hasDomContext: !!data.domContext,
    hasAiKey,
    narrationCapturing,
  });

  const timestamp = Date.now();
  await createStep({
    id: stepId,
    guideId,
    index: stepIndex,
    description: buildFallbackDescription(data.action, data.elementMeta),
    action: data.action,
    url: snap.context.currentUrl,
    timestamp,
    screenshotId,
    elementMeta: data.elementMeta,
    descriptionSource: 'heuristic',
    aiPending: willUseAI || narrationCapturing,
  });
  await addStepToGuide(guideId, stepId);

  const domContext = data.domContext;
  if (data.action !== 'input' && domContext) {
    if (willUseAI) queueDescription(guideId, () => tryAIDescription(stepId, domContext));
    else if (narrationCapturing && hasAiKey) deferDescription(guideId, stepId, domContext);
  }

  if (narrationCapturing) void flushNarrationForStep(guideId, stepId, timestamp);

  return { stepId };
}

export async function handleUpdateInputStep(stepId: string, description: string, inputValue?: string) {
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
  const screenshotId = await takeScreenshot(stepId, elementMeta);
  await updateStepCapture(stepId, elementMeta, screenshotId);

  const guideId = (await getStep(stepId))?.guideId;
  if (domContext && guideId) {
    queueDescription(guideId, () => tryAIDescription(stepId, domContext));
  }
}
