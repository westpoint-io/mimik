import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  clearStepAiPendingMock,
  generateGuideMetaMock,
  getGuideDomainMock,
  getStepsForGuideMock,
  localStorageGetMock,
  updateGuideDescriptionMock,
  updateGuideTitleMock,
  whenNarrationSettledMock,
} = vi.hoisted(() => ({
  clearStepAiPendingMock: vi.fn(),
  generateGuideMetaMock: vi.fn(),
  getGuideDomainMock: vi.fn(),
  getStepsForGuideMock: vi.fn(),
  localStorageGetMock: vi.fn(),
  updateGuideDescriptionMock: vi.fn(),
  updateGuideTitleMock: vi.fn(),
  whenNarrationSettledMock: vi.fn(),
}));

vi.mock('@/core/capture/ai/meta', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/capture/ai/meta')>()),
  generateGuideMeta: generateGuideMetaMock,
}));

vi.mock('@/core/guides/service', () => ({
  clearStepAiPending: clearStepAiPendingMock,
  getGuideDomain: getGuideDomainMock,
  getStepsForGuide: getStepsForGuideMock,
  updateGuideDescription: updateGuideDescriptionMock,
  updateGuideTitle: updateGuideTitleMock,
}));

vi.mock('@/core/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/env')>()),
  localStorage: { get: localStorageGetMock },
}));

vi.mock('../voice', () => ({ whenNarrationSettled: whenNarrationSettledMock }));

import { generateGuideMetaOnStop } from '../guide-meta';

const GUIDE_ID = 'guide-1';

function makeSteps(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    description: `step ${i}`,
    url: `https://example.com/${i}`,
  }));
}

describe('background guide-meta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageGetMock.mockResolvedValue({ aiApiKey: 'key', aiProvider: 'openai', aiModel: 'gpt-4o' });
    getStepsForGuideMock.mockResolvedValue(makeSteps(3));
    getGuideDomainMock.mockResolvedValue('example.com');
    updateGuideTitleMock.mockResolvedValue(undefined);
    updateGuideDescriptionMock.mockResolvedValue(undefined);
    generateGuideMetaMock.mockResolvedValue({ title: 'Generated Title', description: 'Generated description.' });
    whenNarrationSettledMock.mockResolvedValue(undefined);
  });

  describe('generateGuideMetaOnStop', () => {
    it('applies the domain fallback title without calling the model when no key is set', async () => {
      localStorageGetMock.mockResolvedValue({});

      await generateGuideMetaOnStop(GUIDE_ID);

      expect(generateGuideMetaMock).not.toHaveBeenCalled();
      expect(updateGuideTitleMock).toHaveBeenCalledWith(GUIDE_ID, 'background.guideOnDomain[example.com]');
    });

    it('waits for narration before generating a title when a key is set', async () => {
      let settle!: () => void;
      whenNarrationSettledMock.mockReturnValue(
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
      );
      getStepsForGuideMock.mockResolvedValue([
        { id: 'step-1', description: 'step 1', url: 'https://example.com', aiPending: true },
      ]);

      const run = generateGuideMetaOnStop(GUIDE_ID);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(generateGuideMetaMock).not.toHaveBeenCalled();
      expect(updateGuideTitleMock).not.toHaveBeenCalled();

      settle();
      await run;
      expect(clearStepAiPendingMock).toHaveBeenCalledWith('step-1');
      expect(updateGuideTitleMock).toHaveBeenCalledWith(GUIDE_ID, 'Generated Title');
    });
  });
});
