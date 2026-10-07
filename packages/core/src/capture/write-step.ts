import { addStepToGuide, createStep, getStepsForGuide } from '@/core/guides/service';
import type { ElementMeta, Step } from '@/core/guides/types';
import { queueDescription } from './ai/description-queue';
import { readAiCredentials } from './ai/read-ai-credentials';
import { readAiUse } from './ai/read-ai-use';
import type { StepAction } from './step-action';
import { buildFallbackDescription } from './step-description';

export type Describe = () => Promise<void>;

export interface StepNarration {
  take(guideId: string, stepId: string, timestamp: number, describe: Describe | null): void;
}

export interface StepWrite {
  stepId: string;
  guideId: string;
  action: StepAction;
  elementMeta: ElementMeta;
  screenshotId?: string;
  place: Pick<Step, 'url'> & Partial<Pick<Step, 'app' | 'window'>>;
  inputValue?: string;
  describable: boolean;
  describe: Describe;
  narration: StepNarration | null;
}

export interface WrittenStep {
  stepId: string;
  description: string;
  pending: boolean;
}

let writes: Promise<unknown> = Promise.resolve();

function inOrder(write: () => Promise<void>): Promise<void> {
  const next = writes.then(write, write);
  writes = next.catch(() => undefined);
  return next;
}

export async function writeStep(step: StepWrite): Promise<WrittenStep> {
  const [credentials, use] = await Promise.all([readAiCredentials(), readAiUse()]);
  const hasKey = credentials !== null && use.steps;
  const narrating = step.narration !== null;
  const willDescribe = step.describable && hasKey;
  const pending = narrating || willDescribe;
  const description = buildFallbackDescription(step.action, step.elementMeta, step.inputValue);
  const timestamp = Date.now();

  await inOrder(async () => {
    await createStep({
      id: step.stepId,
      guideId: step.guideId,
      index: (await getStepsForGuide(step.guideId)).length,
      description,
      action: step.action,
      ...step.place,
      timestamp,
      screenshotId: step.screenshotId,
      elementMeta: step.elementMeta,
      descriptionSource: 'heuristic',
      aiPending: pending,
      ...(step.inputValue === undefined ? {} : { inputValue: step.inputValue }),
    });
    await addStepToGuide(step.guideId, step.stepId);
  });

  if (step.narration) step.narration.take(step.guideId, step.stepId, timestamp, willDescribe ? step.describe : null);
  else if (willDescribe) queueDescription(step.guideId, step.describe);

  return { stepId: step.stepId, description, pending };
}
