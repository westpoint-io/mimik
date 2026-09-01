import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  clearStepAiPendingMock,
  generateGuideMetaMock,
  getGuideDomainMock,
  getStepsForGuideMock,
  localStorageGetMock,
  updateGuideDescriptionMock,
  updateGuideTitleMock,
} = vi.hoisted(() => ({
  clearStepAiPendingMock: vi.fn(),
  generateGuideMetaMock: vi.fn(),
  getGuideDomainMock: vi.fn(),
  getStepsForGuideMock: vi.fn(),
  localStorageGetMock: vi.fn(),
  updateGuideDescriptionMock: vi.fn(),
  updateGuideTitleMock: vi.fn(),
}));

vi.mock('@/core/capture/ai/meta', () => ({ generateGuideMeta: generateGuideMetaMock }));

vi.mock('@/core/guides/service', () => ({
  clearStepAiPending: clearStepAiPendingMock,
  getGuideDomain: getGuideDomainMock,
  getStepsForGuide: getStepsForGuideMock,
  updateGuideDescription: updateGuideDescriptionMock,
  updateGuideTitle: updateGuideTitleMock,
}));

vi.mock('@/lib/browser-api', () => ({ localStorage: { get: localStorageGetMock } }));

import { AI_PROVIDERS } from '@/core/capture/ai/models';
import { generateDescriptionOnDemand, generateGuideMetaOnStop } from '../guide-meta';

const GUIDE_ID = 'guide-1';

const entryPoints = [
  ['generateGuideMetaOnStop', generateGuideMetaOnStop],
  ['generateDescriptionOnDemand', generateDescriptionOnDemand],
] as const;

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
  });

  describe('input resolution shared by both entry points', () => {
    it.each(entryPoints)('%s sends the first ten and last five of more than fifteen steps', async (_name, run) => {
      getStepsForGuideMock.mockResolvedValue(makeSteps(20));

      await run(GUIDE_ID);

      const sent = generateGuideMetaMock.mock.calls[0][0];
      expect(sent).toHaveLength(15);
      expect(sent[0].description).toBe('step 0');
      expect(sent[9].description).toBe('step 9');
      expect(sent[10].description).toBe('step 15');
      expect(sent[14].description).toBe('step 19');
    });

    it.each(entryPoints)('%s sends every step when there are exactly fifteen', async (_name, run) => {
      getStepsForGuideMock.mockResolvedValue(makeSteps(15));

      await run(GUIDE_ID);

      expect(generateGuideMetaMock.mock.calls[0][0]).toHaveLength(15);
    });

    it.each(entryPoints)('%s drops steps that have no description', async (_name, run) => {
      getStepsForGuideMock.mockResolvedValue([
        { description: 'kept', url: 'https://example.com/a' },
        { description: '', url: 'https://example.com/b' },
      ]);

      await run(GUIDE_ID);

      expect(generateGuideMetaMock.mock.calls[0][0]).toEqual([{ description: 'kept', url: 'https://example.com/a' }]);
    });

    it.each(entryPoints)("%s defaults the model to the provider's own default", async (_name, run) => {
      localStorageGetMock.mockResolvedValue({ aiApiKey: 'key', aiProvider: 'anthropic' });

      await run(GUIDE_ID);

      expect(generateGuideMetaMock).toHaveBeenCalledWith(
        expect.anything(),
        'anthropic',
        AI_PROVIDERS.anthropic.defaultModel,
        'key',
        undefined,
      );
    });

    it.each(entryPoints)('%s defaults the provider to OpenAI when none is stored', async (_name, run) => {
      localStorageGetMock.mockResolvedValue({ aiApiKey: 'key' });

      await run(GUIDE_ID);

      expect(generateGuideMetaMock).toHaveBeenCalledWith(
        expect.anything(),
        'openai',
        AI_PROVIDERS.openai.defaultModel,
        'key',
        undefined,
      );
    });
  });

  describe('generateGuideMetaOnStop', () => {
    it('applies the domain fallback title without calling the model when no key is set', async () => {
      localStorageGetMock.mockResolvedValue({});

      await generateGuideMetaOnStop(GUIDE_ID);

      expect(generateGuideMetaMock).not.toHaveBeenCalled();
      expect(updateGuideTitleMock).toHaveBeenCalledWith(GUIDE_ID, 'background.guideOnDomain[example.com]');
    });

    it('falls back to the generic title when the guide has no domain', async () => {
      localStorageGetMock.mockResolvedValue({});
      getGuideDomainMock.mockResolvedValue('');

      await generateGuideMetaOnStop(GUIDE_ID);

      expect(updateGuideTitleMock).toHaveBeenCalledWith(GUIDE_ID, 'background.newGuide');
    });

    it('writes no title at all when no step has a description', async () => {
      getStepsForGuideMock.mockResolvedValue([{ description: '', url: 'https://example.com' }]);

      await generateGuideMetaOnStop(GUIDE_ID);

      expect(generateGuideMetaMock).not.toHaveBeenCalled();
      expect(updateGuideTitleMock).not.toHaveBeenCalled();
      expect(updateGuideDescriptionMock).not.toHaveBeenCalled();
    });

    it('applies the fallback title when the model yields nothing', async () => {
      generateGuideMetaMock.mockResolvedValue(null);

      await generateGuideMetaOnStop(GUIDE_ID);

      expect(updateGuideTitleMock).toHaveBeenCalledWith(GUIDE_ID, 'background.guideOnDomain[example.com]');
    });

    it('stores both the title and the description on success', async () => {
      await generateGuideMetaOnStop(GUIDE_ID);

      expect(updateGuideTitleMock).toHaveBeenCalledWith(GUIDE_ID, 'Generated Title');
      expect(updateGuideDescriptionMock).toHaveBeenCalledWith(GUIDE_ID, 'Generated description.');
    });

    it('keeps the generated title when the description write fails', async () => {
      updateGuideDescriptionMock.mockRejectedValue(new Error('QuotaExceededError'));

      await generateGuideMetaOnStop(GUIDE_ID);

      expect(updateGuideTitleMock).toHaveBeenCalledTimes(1);
      expect(updateGuideTitleMock).toHaveBeenCalledWith(GUIDE_ID, 'Generated Title');
    });

    it('applies the fallback title when the title write itself fails', async () => {
      updateGuideTitleMock.mockRejectedValueOnce(new Error('DatabaseClosedError'));

      await generateGuideMetaOnStop(GUIDE_ID);

      expect(updateGuideTitleMock).toHaveBeenNthCalledWith(2, GUIDE_ID, 'background.guideOnDomain[example.com]');
    });
  });

  describe('generateDescriptionOnDemand', () => {
    it('reports a missing key without touching the guide', async () => {
      localStorageGetMock.mockResolvedValue({});

      await expect(generateDescriptionOnDemand(GUIDE_ID)).resolves.toEqual({ error: 'no-api-key' });
      expect(updateGuideTitleMock).not.toHaveBeenCalled();
      expect(updateGuideDescriptionMock).not.toHaveBeenCalled();
    });

    it('reports a guide with no described steps', async () => {
      getStepsForGuideMock.mockResolvedValue([]);

      await expect(generateDescriptionOnDemand(GUIDE_ID)).resolves.toEqual({ error: 'no-steps' });
      expect(generateGuideMetaMock).not.toHaveBeenCalled();
    });

    it('reports a failed generation', async () => {
      generateGuideMetaMock.mockResolvedValue(null);

      await expect(generateDescriptionOnDemand(GUIDE_ID)).resolves.toEqual({ error: 'generation-failed' });
      expect(updateGuideDescriptionMock).not.toHaveBeenCalled();
    });

    it('reports a failed generation when the model returns a title but no description', async () => {
      generateGuideMetaMock.mockResolvedValue({ title: 'Generated Title' });

      await expect(generateDescriptionOnDemand(GUIDE_ID)).resolves.toEqual({ error: 'generation-failed' });
      expect(updateGuideDescriptionMock).not.toHaveBeenCalled();
    });

    it('resolves to save-failed rather than rejecting when the write throws', async () => {
      updateGuideDescriptionMock.mockRejectedValue(new Error('QuotaExceededError'));

      await expect(generateDescriptionOnDemand(GUIDE_ID)).resolves.toEqual({ error: 'save-failed' });
    });

    it('resolves to save-failed rather than rejecting when reading the inputs throws', async () => {
      localStorageGetMock.mockRejectedValue(new Error('DatabaseClosedError'));

      await expect(generateDescriptionOnDemand(GUIDE_ID)).resolves.toEqual({ error: 'save-failed' });
    });

    it('stores and returns the description, leaving the title untouched', async () => {
      await expect(generateDescriptionOnDemand(GUIDE_ID)).resolves.toEqual({
        description: 'Generated description.',
      });
      expect(updateGuideDescriptionMock).toHaveBeenCalledWith(GUIDE_ID, 'Generated description.');
      expect(updateGuideTitleMock).not.toHaveBeenCalled();
    });
  });
});
