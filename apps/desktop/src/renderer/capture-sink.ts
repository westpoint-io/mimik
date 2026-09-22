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
  getStepsForGuide,
  saveScreenshot,
  updateStepDescription,
} from '@mimik/core/guides/service';
import { screenshotForElement } from '@mimik/core/screenshot/record';
import type { CursorMark } from '@mimik/core/screenshot/types';
import { describeStep } from './ai';

export type DesktopCaptureStepData = CaptureStepData & { cursor?: CursorMark; inputValue?: string };

export class DesktopCaptureSink implements CaptureSink {
  async startGuide(): Promise<string> {
    const guide = await createGuide(crypto.randomUUID());
    return guide.id;
  }

  async captureStep(data: DesktopCaptureStepData): Promise<CaptureStepResponse & { title?: string }> {
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
          cursor: data.cursor ?? null,
          targetColor,
        },
        meta,
      );
      await saveScreenshot(screenshot);
      screenshotId = screenshot.id;
    }

    const description = buildFallbackDescription(data.action, meta);

    await createStep({
      id: stepId,
      guideId: data.guideId,
      index,
      description,
      action: data.action,
      url: '',
      app: meta.app,
      window: meta.window,
      timestamp: Date.now(),
      screenshotId,
      elementMeta: meta,
      descriptionSource: 'heuristic',
      aiPending: true,
      ...(data.inputValue === undefined ? {} : { inputValue: data.inputValue }),
    });
    await addStepToGuide(data.guideId, stepId);

    void describeStep(data.action, meta).then(async (written) => {
      if (written) await updateStepDescription(stepId, written);
      await clearStepAiPending(stepId);
    });

    return { stepId, title: description };
  }

  async updateInputStep(data: UpdateInputStepData): Promise<UpdateInputStepResponse> {
    await updateStepDescription(data.stepId, data.description);
    return { updated: true };
  }

  async finalizeInputStep(_data: FinalizeInputStepData): Promise<FinalizeInputStepResponse> {
    return { updated: false };
  }
}
