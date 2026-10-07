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

vi.mock('../meta', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../meta')>()),
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

import { i18n } from '@/core/env';
import { finishGuide } from '../finish-guide';
import { generateDescriptionOnDemand } from '../guide-description';
import { AI_PROVIDERS } from '../models';

const GUIDE_ID = 'guide-1';

async function fallbackTitle(guideId: string): Promise<string> {
  const domain = await getGuideDomainMock(guideId);
  return domain ? i18n.t('background.guideOnDomain', [domain]) : i18n.t('background.newGuide');
}

const finish = (guideId: string) =>
  finishGuide(guideId, { fallbackTitle, settleNarration: () => whenNarrationSettledMock() });

const entryPoints = [
  ['finishGuide', finish],
  ['generateDescriptionOnDemand', generateDescriptionOnDemand],
] as const;

function makeSteps(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    description: `step ${i}`,
    url: `https://example.com/${i}`,
  }));
}

describe('guide meta', () => {
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

      expect(generateGuideMetaMock.mock.calls[0][0]).toEqual([{ description: 'kept', place: 'https://example.com/a' }]);
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

  describe('finishGuide', () => {
    it('applies the domain fallback title without calling the model when AI is off for the guide', async () => {
      localStorageGetMock.mockResolvedValue({
        aiApiKey: 'key',
        aiProvider: 'openai',
        aiModel: 'gpt-4o',
        aiForGuide: false,
      });

      await finish(GUIDE_ID);

      expect(generateGuideMetaMock).not.toHaveBeenCalled();
      expect(updateGuideTitleMock).toHaveBeenCalledWith(GUIDE_ID, 'background.guideOnDomain[example.com]');
    });

    it('applies the domain fallback title without calling the model when no key is set', async () => {
      localStorageGetMock.mockResolvedValue({});

      await finish(GUIDE_ID);

      expect(generateGuideMetaMock).not.toHaveBeenCalled();
      expect(updateGuideTitleMock).toHaveBeenCalledWith(GUIDE_ID, 'background.guideOnDomain[example.com]');
    });

    it('writes the fallback title before narration settles when no key is set', async () => {
      localStorageGetMock.mockResolvedValue({});
      let settle!: () => void;
      whenNarrationSettledMock.mockReturnValue(
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
      );
      getStepsForGuideMock.mockResolvedValue([
        { id: 'step-1', description: '', url: 'https://example.com', aiPending: true },
      ]);

      const run = finish(GUIDE_ID);
      await vi.waitFor(() =>
        expect(updateGuideTitleMock).toHaveBeenCalledWith(GUIDE_ID, 'background.guideOnDomain[example.com]'),
      );
      expect(clearStepAiPendingMock).not.toHaveBeenCalled();

      settle();
      await run;
      expect(clearStepAiPendingMock).toHaveBeenCalledWith('step-1');
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

      const run = finish(GUIDE_ID);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(generateGuideMetaMock).not.toHaveBeenCalled();
      expect(updateGuideTitleMock).not.toHaveBeenCalled();

      settle();
      await run;
      expect(clearStepAiPendingMock).toHaveBeenCalledWith('step-1');
      expect(updateGuideTitleMock).toHaveBeenCalledWith(GUIDE_ID, 'Generated Title');
    });

    it('still clears aiPending when the fallback title write fails', async () => {
      localStorageGetMock.mockResolvedValue({});
      updateGuideTitleMock.mockRejectedValue(new Error('DatabaseClosedError'));
      getStepsForGuideMock.mockResolvedValue([
        { id: 'step-1', description: '', url: 'https://example.com', aiPending: true },
      ]);

      await expect(finish(GUIDE_ID)).resolves.toBeUndefined();

      expect(clearStepAiPendingMock).toHaveBeenCalledWith('step-1');
    });

    it('writes the fallback title only once when settling fails, so a rename in the meantime survives', async () => {
      localStorageGetMock.mockResolvedValue({});
      getStepsForGuideMock.mockRejectedValue(new Error('DatabaseClosedError'));

      await expect(finish(GUIDE_ID)).resolves.toBeUndefined();

      expect(updateGuideTitleMock).toHaveBeenCalledTimes(1);
    });

    it('applies the fallback title and settles when the key cannot be read', async () => {
      localStorageGetMock.mockRejectedValue(new Error('DatabaseClosedError'));
      getStepsForGuideMock.mockResolvedValue([
        { id: 'step-1', description: '', url: 'https://example.com', aiPending: true },
      ]);

      await finish(GUIDE_ID);

      expect(generateGuideMetaMock).not.toHaveBeenCalled();
      expect(updateGuideTitleMock).toHaveBeenCalledWith(GUIDE_ID, 'background.guideOnDomain[example.com]');
      expect(clearStepAiPendingMock).toHaveBeenCalledWith('step-1');
    });

    it('falls back to the generic title when the guide has no domain', async () => {
      localStorageGetMock.mockResolvedValue({});
      getGuideDomainMock.mockResolvedValue('');

      await finish(GUIDE_ID);

      expect(updateGuideTitleMock).toHaveBeenCalledWith(GUIDE_ID, 'background.newGuide');
    });

    it('names a guide with no described step by the fallback, without asking the model', async () => {
      getStepsForGuideMock.mockResolvedValue([{ description: '', url: 'https://example.com' }]);

      await finish(GUIDE_ID);

      expect(generateGuideMetaMock).not.toHaveBeenCalled();
      expect(updateGuideTitleMock).toHaveBeenCalledTimes(1);
      expect(updateGuideDescriptionMock).not.toHaveBeenCalled();
    });

    it('applies the fallback title when the model yields nothing', async () => {
      generateGuideMetaMock.mockResolvedValue(null);

      await finish(GUIDE_ID);

      expect(updateGuideTitleMock).toHaveBeenCalledWith(GUIDE_ID, 'background.guideOnDomain[example.com]');
    });

    it('stores both the title and the description on success', async () => {
      await finish(GUIDE_ID);

      expect(updateGuideTitleMock).toHaveBeenCalledWith(GUIDE_ID, 'Generated Title');
      expect(updateGuideDescriptionMock).toHaveBeenCalledWith(GUIDE_ID, 'Generated description.');
    });

    it('keeps the generated title when the description write fails', async () => {
      updateGuideDescriptionMock.mockRejectedValue(new Error('QuotaExceededError'));

      await finish(GUIDE_ID);

      expect(updateGuideTitleMock).toHaveBeenCalledTimes(1);
      expect(updateGuideTitleMock).toHaveBeenCalledWith(GUIDE_ID, 'Generated Title');
    });

    it('applies the fallback title when the title write itself fails', async () => {
      updateGuideTitleMock.mockRejectedValueOnce(new Error('DatabaseClosedError'));

      await finish(GUIDE_ID);

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
