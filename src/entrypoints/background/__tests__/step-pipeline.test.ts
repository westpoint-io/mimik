import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { CaptureState, captureMachine } from '@/core/capture/machine';

const { addStepToGuideMock, createStepMock, localStorageGetMock, saveScreenshotMock } = vi.hoisted(() => ({
  addStepToGuideMock: vi.fn(),
  createStepMock: vi.fn(),
  localStorageGetMock: vi.fn(),
  saveScreenshotMock: vi.fn(),
}));

vi.mock('@/core/guides/service', () => ({
  addStepToGuide: addStepToGuideMock,
  createStep: createStepMock,
  saveScreenshot: saveScreenshotMock,
}));

vi.mock('@/core/guides/db', () => ({ db: {} }));

vi.mock('@/lib/browser-api', () => ({
  captureVisibleTab: vi.fn(),
  localStorage: { get: localStorageGetMock },
}));

vi.mock('../actor', () => ({ getActor: () => actor }));

import type { CaptureStepData } from '@/lib/messaging';
import { handleCaptureStep } from '../step-pipeline';

const actor = createActor(captureMachine);
actor.start();

const elementMeta = {
  tag: 'button',
  cssSelector: 'button.pay',
  textContent: 'Pay now',
  ariaLabel: null,
  placeholder: null,
  altText: null,
  name: null,
  role: null,
  href: null,
  inputType: null,
  dataTestId: null,
  rect: { x: 10, y: 20, width: 80, height: 30 },
  devicePixelRatio: 1,
} satisfies CaptureStepData['elementMeta'];

const step: CaptureStepData = {
  guideId: 'guide-1',
  action: 'click',
  elementMeta,
};

function startRecording() {
  actor.send({ type: 'START_RECORDING', url: 'https://example.com' });
  return actor.getSnapshot().context.currentGuideId!;
}

describe('handleCaptureStep while blur mode pauses capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageGetMock.mockResolvedValue({});
    createStepMock.mockResolvedValue(undefined);
    addStepToGuideMock.mockResolvedValue(undefined);
    actor.send({ type: 'STOP_RECORDING' });
  });

  it('refuses steps while PAUSED, the reporter outcome', async () => {
    startRecording();
    actor.send({ type: 'PAUSE_CAPTURE' });
    expect(actor.getSnapshot().value).toBe(CaptureState.PAUSED);

    const res = await handleCaptureStep(step);

    expect(res).toEqual({ ignored: true });
    expect(createStepMock).not.toHaveBeenCalled();
    expect(addStepToGuideMock).not.toHaveBeenCalled();
  });

  it('creates the step with the same wiring in RECORDING, proving the boundary is faithful', async () => {
    const guideId = startRecording();

    const res = await handleCaptureStep({ ...step, guideId });

    expect(res).toEqual({ stepId: expect.any(String) });
    expect(createStepMock).toHaveBeenCalledTimes(1);
    expect(createStepMock.mock.calls[0][0].guideId).toBe(guideId);
    expect(addStepToGuideMock).toHaveBeenCalledTimes(1);
  });
});
