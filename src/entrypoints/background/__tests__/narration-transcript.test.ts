import { beforeEach, describe, expect, it, vi } from 'vitest';

const saveTranscript = vi.fn();
const applyNarrationToSteps = vi.fn();
const findExistingStepIds = vi.fn();

vi.mock('@/core/guides/service', () => ({
  saveTranscript: (...args: unknown[]) => saveTranscript(...args),
  applyNarrationToSteps: (...args: unknown[]) => applyNarrationToSteps(...args),
  findExistingStepIds: (...args: unknown[]) => findExistingStepIds(...args),
  getStepsForGuide: vi.fn(),
}));

vi.mock('../deferred-descriptions', () => ({ discardDeferred: vi.fn() }));
vi.mock('../describe-unnarrated', () => ({ describeStepNow: vi.fn(), describeUnnarratedSteps: vi.fn() }));

import { applyNarration, takeNarrated } from '../voice';

const transcript = {
  epochMs: 1_700_000_000_000,
  lines: [
    { start: 1, end: 3, text: 'Open the billing tab', stepId: 's1', rejectReason: null },
    { start: 4, end: 5, text: 'you', stepId: null, rejectReason: 'solo-filler:you' },
  ],
};

const stats = {
  batches: 1,
  failedBatches: 0,
  droppedBatches: 0,
  forcedSplits: 0,
  verbatimSegments: 1,
  splitSegments: 0,
  rejectedSegments: 1,
};

beforeEach(() => {
  saveTranscript.mockReset().mockResolvedValue(undefined);
  applyNarrationToSteps.mockReset().mockResolvedValue(undefined);
  findExistingStepIds.mockReset().mockResolvedValue(['s1']);
  takeNarrated('g1');
});

describe('applying a narration result', () => {
  it('stores the transcript, rejected lines and all', async () => {
    await applyNarration(
      'g1',
      { descriptions: [{ stepId: 's1', text: 'Open the billing tab' }], transcript, stats },
      false,
    );

    expect(saveTranscript).toHaveBeenCalledWith('g1', transcript);
  });

  it('stores a slice that attributed nothing at all', async () => {
    const orphaned = { epochMs: transcript.epochMs, lines: [transcript.lines[1]] };

    await applyNarration('g1', { descriptions: [], transcript: orphaned, stats }, false);

    expect(saveTranscript).toHaveBeenCalledWith('g1', orphaned);
    expect(applyNarrationToSteps).toHaveBeenCalledWith([]);
  });

  it('keeps each transcribed slice as its own stored row', async () => {
    const second = { epochMs: transcript.epochMs + 30_000, lines: transcript.lines };

    await applyNarration('g1', { descriptions: [], transcript, stats }, false);
    await applyNarration('g1', { descriptions: [], transcript: second, stats }, false);

    expect(saveTranscript).toHaveBeenCalledTimes(2);
    expect(saveTranscript.mock.calls.map((call) => call[1].epochMs)).toEqual([transcript.epochMs, second.epochMs]);
  });

  it('still applies the narration when the transcript cannot be stored', async () => {
    saveTranscript.mockRejectedValue(new Error('QuotaExceededError'));

    await applyNarration(
      'g1',
      { descriptions: [{ stepId: 's1', text: 'Open the billing tab' }], transcript, stats },
      false,
    );

    expect(applyNarrationToSteps).toHaveBeenCalledWith([{ stepId: 's1', description: 'Open the billing tab' }]);
  });
});
