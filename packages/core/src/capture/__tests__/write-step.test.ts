import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ElementMeta } from '@/core/guides/types';

const created: Array<Record<string, unknown>> = [];
let hasKey = true;
let aiForSteps = true;

vi.mock('@/core/guides/service', () => ({
  createStep: vi.fn(async (step: Record<string, unknown>) => {
    created.push(step);
  }),
  addStepToGuide: vi.fn(async () => undefined),
  getStepsForGuide: vi.fn(async () => created),
}));
vi.mock('../ai/read-ai-credentials', () => ({
  readAiCredentials: vi.fn(async () => (hasKey ? { provider: 'openai', model: 'm', apiKey: 'k' } : null)),
}));
vi.mock('../ai/description-queue', () => ({ queueDescription: vi.fn() }));
vi.mock('../ai/read-ai-use', () => ({ readAiUse: vi.fn(async () => ({ steps: aiForSteps, guide: true })) }));

import { queueDescription } from '../ai/description-queue';
import { buildFallbackDescription } from '../step-description';
import { type StepWrite, writeStep } from '../write-step';

const meta = { role: 'button', ariaLabel: 'Save', rect: { x: 0, y: 0, width: 1, height: 1 } } as ElementMeta;

function step(overrides: Partial<StepWrite> = {}): StepWrite {
  return {
    stepId: `s${created.length}`,
    guideId: 'g',
    action: 'click',
    elementMeta: meta,
    place: { url: '' },
    describable: true,
    describe: vi.fn(async () => undefined),
    narration: null,
    ...overrides,
  };
}

beforeEach(() => {
  created.length = 0;
  hasKey = true;
  aiForSteps = true;
  vi.mocked(queueDescription).mockClear();
});

describe('writeStep', () => {
  it('writes the basic title, numbers the step, and queues the AI description when there is a key', async () => {
    const first = await writeStep(step());
    await writeStep(step());

    expect(first).toMatchObject({ description: buildFallbackDescription('click', meta), pending: true });
    expect(created.map((row) => row.index)).toEqual([0, 1]);
    expect(queueDescription).toHaveBeenCalledTimes(2);
  });

  it('leaves the step settled and asks nothing when AI is off for steps, even with a key', async () => {
    aiForSteps = false;
    const written = await writeStep(step());

    expect(written.pending).toBe(false);
    expect(queueDescription).not.toHaveBeenCalled();
  });

  it('leaves the step settled and asks nothing without a key', async () => {
    hasKey = false;
    const written = await writeStep(step());

    expect(written.pending).toBe(false);
    expect(queueDescription).not.toHaveBeenCalled();
  });

  it('hands the step to narration instead of the queue while the microphone is on', async () => {
    const take = vi.fn();
    const describe = vi.fn(async () => undefined);
    const written = await writeStep(step({ narration: { take }, describe }));

    expect(written.pending).toBe(true);
    expect(take).toHaveBeenCalledWith('g', written.stepId, expect.any(Number), describe);
    expect(queueDescription).not.toHaveBeenCalled();
  });

  it('gives narration no AI fallback for a step that cannot be described', async () => {
    const take = vi.fn();
    await writeStep(step({ narration: { take }, describable: false }));

    expect(take).toHaveBeenCalledWith('g', expect.any(String), expect.any(Number), null);
  });

  it('marks nothing pending for a step that cannot be described while nothing listens', async () => {
    const written = await writeStep(step({ action: 'input', describable: false }));

    expect(written.pending).toBe(false);
    expect(queueDescription).not.toHaveBeenCalled();
  });
});
