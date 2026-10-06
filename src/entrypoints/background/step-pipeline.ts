import { logger } from '@mimik/core/logger';
import { queueDescription } from '@/core/capture/ai/description-queue';
import { AI_CREDENTIAL_SETTINGS, resolveAiCredentials } from '@/core/capture/ai/keys';
import type { DOMContext } from '@/core/capture/dom/context';
import { isLive } from '@/core/capture/is-live';
import { CaptureState } from '@/core/capture/machine';
import { buildFallbackDescription } from '@/core/capture/step-description';
import {
  addStepToGuide,
  clearStepAiPending,
  createStep,
  getStep,
  getStepsForGuide,
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
import { generateAiDescription } from './ai-description';
import { deferDescription, shouldQueueAiDescription } from './deferred-descriptions';
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

let stepWrites: Promise<unknown> = Promise.resolve();

function writeInOrder(write: () => Promise<void>): Promise<void> {
  const next = stepWrites.then(write, write);
  stepWrites = next.catch(() => undefined);
  return next;
}

async function tryAIDescription(stepId: string, domContext: DOMContext) {
  if (!resolveAiCredentials(await localStorage.get([...AI_CREDENTIAL_SETTINGS]))) return;
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

  getActor().send({ type: 'USER_ACTION' });

  const guideId = snap.context.currentGuideId!;
  const stepId = crypto.randomUUID();

  const screenshotId = await takeScreenshot(stepId, data.elementMeta);

  const narrationCapturing = getVoiceUpdate().phase === 'recording';
  const hasAiKey = resolveAiCredentials(await localStorage.get([...AI_CREDENTIAL_SETTINGS])) !== null;
  const willUseAI = shouldQueueAiDescription({
    action: data.action,
    hasDomContext: !!data.domContext,
    hasAiKey,
    narrationCapturing,
  });

  const timestamp = Date.now();
  await writeInOrder(async () => {
    await createStep({
      id: stepId,
      guideId,
      index: (await getStepsForGuide(guideId)).length,
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
  });

  const domContext = data.domContext;
  if (data.action !== 'input' && domContext) {
    if (willUseAI) queueDescription(guideId, () => tryAIDescription(stepId, domContext));
    else if (narrationCapturing && hasAiKey) deferDescription(guideId, stepId, domContext);
  }

  if (narrationCapturing) void flushNarrationForStep(guideId, stepId, timestamp);

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
  if (domContext && guideId) {
    queueDescription(guideId, () => tryAIDescription(stepId, domContext));
  }
}
