import { queueDescription } from '@mimik/core/capture/ai/description-queue';
import type {
  CaptureSink,
  CaptureStepData,
  CaptureStepResponse,
  FinalizeInputStepData,
  FinalizeInputStepResponse,
  UpdateInputStepData,
  UpdateInputStepResponse,
} from '@mimik/core/capture/sink';
import { buildFallbackDescription } from '@mimik/core/capture/step-description';
import { localStorage } from '@mimik/core/env';
import {
  addStepToGuide,
  clearStepAiPending,
  createGuide,
  createStep,
  getStep,
  getStepsForGuide,
  saveScreenshot,
  updateStepDescription,
} from '@mimik/core/guides/service';
import { screenshotForElement } from '@mimik/core/screenshot/record';
import { credentials } from './ai/credentials';
import { describeStep } from './ai/describe-step';
import type { DesktopNarration } from './narration';

export type DesktopCaptureStepData = CaptureStepData & {
  inputValue?: string;
  zoomLevel?: number;
};

export class DesktopCaptureSink implements CaptureSink {
  constructor(private readonly narration?: DesktopNarration) {}

  async createGuide({
    guideId,
    staging = false,
  }: {
    guideId?: string | null;
    staging?: boolean;
  } = {}): Promise<string> {
    const guide = await createGuide(guideId ?? crypto.randomUUID(), staging);
    return guide.id;
  }

  async captureStep(
    data: DesktopCaptureStepData,
  ): Promise<CaptureStepResponse & { title?: string; pending?: boolean }> {
    const stepId = crypto.randomUUID();
    const meta = data.elementMeta;
    const index = (await getStepsForGuide(data.guideId)).length;

    let screenshotId: string | undefined;
    if (data.image) {
      const { targetColor } = await localStorage.get(['targetColor']);
      const screenshot = screenshotForElement(
        {
          id: data.image.screenshotId,
          src: data.image.src,
          stepId,
          mimeType: 'image/png',
          width: data.image.width,
          height: data.image.height,
          targetColor,
          zoom: 'click',
          zoomLevel: data.zoomLevel,
        },
        meta,
      );
      await saveScreenshot(screenshot);
      screenshotId = screenshot.id;
    }

    const description = buildFallbackDescription(data.action, meta, data.inputValue);
    const hasKey = (await credentials()) !== null;
    const narrationCapturing = this.narration?.update.phase === 'recording';
    const pending = hasKey || narrationCapturing;
    const timestamp = Date.now();

    await createStep({
      id: stepId,
      guideId: data.guideId,
      index,
      description,
      action: data.action,
      url: '',
      app: meta.app,
      window: meta.window,
      timestamp,
      screenshotId,
      elementMeta: meta,
      descriptionSource: 'heuristic',
      aiPending: pending,
      ...(data.inputValue === undefined ? {} : { inputValue: data.inputValue }),
    });
    await addStepToGuide(data.guideId, stepId);

    const describe = async () => {
      const previous = (await getStepsForGuide(data.guideId)).find((step) => step.index === index - 1);
      const { text, failure } = await describeStep(data.action, meta, previous?.description);
      await clearStepAiPending(stepId, text ?? undefined);
      const written = (await getStep(stepId))?.descriptionSource === 'ai';
      window.mimik.capture.described(stepId, written ? text : null, failure);
    };
    if (narrationCapturing) this.narration?.flushForStep(data.guideId, { stepId, timestamp }, hasKey ? describe : null);
    else if (hasKey) queueDescription(data.guideId, describe);

    return { stepId, title: description, pending };
  }

  async updateInputStep(data: UpdateInputStepData): Promise<UpdateInputStepResponse> {
    await updateStepDescription(data.stepId, data.description);
    return { updated: true };
  }

  async finalizeInputStep(_data: FinalizeInputStepData): Promise<FinalizeInputStepResponse> {
    return { updated: false };
  }
}
