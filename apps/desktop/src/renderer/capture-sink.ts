import { describeStep } from '@mimik/core/capture/ai/describe-step';
import { SCREEN_STEP_DESCRIPTION_PROMPT } from '@mimik/core/capture/ai/prompts';
import { serializeScreenContext } from '@mimik/core/capture/ai/screen-context';
import type { CaptureStepData } from '@mimik/core/capture/sink';
import { type StepNarration, writeStep } from '@mimik/core/capture/write-step';
import { localStorage } from '@mimik/core/env';
import { clearStepAiPending, createGuide, getStep, getStepsForGuide, saveScreenshot } from '@mimik/core/guides/service';
import { screenshotForElement } from '@mimik/core/screenshot/record';
import type { DesktopNarration } from './narration';

export type DesktopCaptureStepData = CaptureStepData & {
  inputValue?: string;
  zoomLevel?: number;
};

export class DesktopCaptureSink {
  private readonly narration: StepNarration | null;

  constructor(private readonly desktopNarration?: DesktopNarration) {
    this.narration = desktopNarration
      ? {
          take: (guideId, stepId, timestamp, describe) =>
            desktopNarration.flushForStep(guideId, { stepId, timestamp }, describe),
        }
      : null;
  }

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

  async captureStep(data: DesktopCaptureStepData): Promise<{ stepId: string; title: string; pending: boolean }> {
    const stepId = crypto.randomUUID();
    const meta = data.elementMeta;

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

    const describe = async () => {
      const steps = await getStepsForGuide(data.guideId);
      const previous = steps[steps.findIndex((step) => step.id === stepId) - 1];
      const { text, failure } = await describeStep(
        serializeScreenContext(data.action, meta, previous?.description),
        SCREEN_STEP_DESCRIPTION_PROMPT,
      );
      await clearStepAiPending(stepId, text ?? undefined);
      const written = (await getStep(stepId))?.descriptionSource === 'ai';
      window.mimik.capture.described(stepId, written ? text : null, failure);
    };

    const written = await writeStep({
      stepId,
      guideId: data.guideId,
      action: data.action,
      elementMeta: meta,
      screenshotId,
      place: { url: '', app: meta.app, window: meta.window },
      inputValue: data.inputValue,
      describable: true,
      describe,
      narration: this.desktopNarration?.update.phase === 'recording' ? this.narration : null,
    });

    return { stepId, title: written.description, pending: written.pending };
  }
}
