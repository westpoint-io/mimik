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
import { credentials } from './ai/credentials';
import { describeStep } from './ai/describe-step';

export type DesktopCaptureStepData = CaptureStepData & {
  cursor?: CursorMark;
  inputValue?: string;
  zoomLevel?: number;
};

export class DesktopCaptureSink implements CaptureSink {
  async startGuide(): Promise<string> {
    const guide = await createGuide(crypto.randomUUID());
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
          cursor: data.cursor ?? null,
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
    const pending = (await credentials()) !== null;

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
      aiPending: pending,
      ...(data.inputValue === undefined ? {} : { inputValue: data.inputValue }),
    });
    await addStepToGuide(data.guideId, stepId);

    if (pending) {
      void describeStep(data.action, meta).then(async (written) => {
        if (written) await updateStepDescription(stepId, written, 'ai');
        await clearStepAiPending(stepId);
        window.mimik.capture.described(stepId, written);
      });
    }

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
