import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CaptureState } from '@/core/capture/machine';
import type { ElementMeta } from '@/core/guides/types';

let state: string = CaptureState.RECORDING;

const send = vi.fn();
const updateStepDescription = vi.fn();
const stepsUpdate = vi.fn();
const captureVisibleTab = vi.fn();

vi.mock('../actor', () => ({
  getActor: () => ({
    getSnapshot: () => ({ value: state, context: { stepCount: 0, currentGuideId: 'guide-1', currentUrl: '/' } }),
    send,
  }),
}));

vi.mock('@/core/guides/service', () => ({
  addStepToGuide: vi.fn(),
  clearStepAiPending: vi.fn(),
  createStep: vi.fn(),
  saveScreenshot: vi.fn(),
  updateStepDescription: (...args: unknown[]) => updateStepDescription(...args),
}));

vi.mock('@/core/guides/db', () => ({
  db: { steps: { update: (...args: unknown[]) => stepsUpdate(...args), get: vi.fn() } },
}));

vi.mock('@/lib/browser-api', () => ({
  captureVisibleTab: (...args: unknown[]) => captureVisibleTab(...args),
  localStorage: { get: vi.fn().mockResolvedValue({}) },
}));

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../voice', () => ({ getVoiceUpdate: () => ({ phase: 'idle' }), flushNarrationForStep: vi.fn() }));
vi.mock('../ai-description', () => ({ generateAiDescription: vi.fn() }));
vi.mock('../description-queue', () => ({ queueDescription: vi.fn() }));
vi.mock('../deferred-descriptions', () => ({ deferDescription: vi.fn(), shouldQueueAiDescription: () => false }));
vi.mock('@/core/capture/ai/keys', () => ({ AI_KEY_SETTINGS: [], resolveAiKey: () => ({ apiKey: undefined }) }));

const meta = { rect: { x: 0, y: 0, width: 10, height: 10 }, devicePixelRatio: 1 } as ElementMeta;

beforeEach(() => {
  vi.clearAllMocks();
  state = CaptureState.RECORDING;
});

describe('step writes while PAUSED', () => {
  it('ignores a captureStep', async () => {
    const { handleCaptureStep } = await import('../step-pipeline');
    state = CaptureState.PAUSED;

    const res = await handleCaptureStep({ guideId: 'guide-1', action: 'click', elementMeta: meta });

    expect(res).toEqual({ ignored: true });
    expect(send).not.toHaveBeenCalled();
    expect(captureVisibleTab).not.toHaveBeenCalled();
  });

  it('ignores an input step update', async () => {
    const { handleUpdateInputStep } = await import('../step-pipeline');
    state = CaptureState.PAUSED;

    await handleUpdateInputStep('step-1', 'Type secret');

    expect(updateStepDescription).not.toHaveBeenCalled();
  });

  it('still finalizes an input step, so the typed text is not lost', async () => {
    captureVisibleTab.mockRejectedValue(new Error('no tab in this harness'));
    const { handleFinalizeInputStep } = await import('../step-pipeline');
    state = CaptureState.PAUSED;

    await handleFinalizeInputStep('step-1', meta, undefined);

    expect(captureVisibleTab).toHaveBeenCalled();
    expect(stepsUpdate).toHaveBeenCalledWith('step-1', { elementMeta: meta });
  });

  it('refuses a finalize once the recording has ended', async () => {
    const { handleFinalizeInputStep } = await import('../step-pipeline');
    state = CaptureState.IDLE;

    await handleFinalizeInputStep('step-1', meta, undefined);

    expect(captureVisibleTab).not.toHaveBeenCalled();
    expect(stepsUpdate).not.toHaveBeenCalled();
  });

  it('still writes an input step update while RECORDING', async () => {
    const { handleUpdateInputStep } = await import('../step-pipeline');

    await handleUpdateInputStep('step-1', 'Type hello');

    expect(updateStepDescription).toHaveBeenCalledWith('step-1', 'Type hello');
  });
});
