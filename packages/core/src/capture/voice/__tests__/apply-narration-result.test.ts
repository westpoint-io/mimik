import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NarrationResult } from '../types';

vi.mock('@/core/guides/service', () => ({
  saveTranscript: vi.fn(async () => {
    throw new Error('quota');
  }),
  findExistingStepIds: vi.fn(async (ids: string[]) => ids.filter((id) => id !== 'deleted')),
  applyNarrationToSteps: vi.fn(async () => undefined),
}));

import { applyNarrationResult } from '../apply-narration-result';
import { clearDeferredDescriptions, deferDescription, takeDeferredDescriptions } from '../deferred-descriptions';

const result = {
  descriptions: [
    { stepId: 's1', text: 'Open billing' },
    { stepId: 'deleted', text: 'Gone' },
  ],
  transcript: { epochMs: 0, lines: [] },
  stats: {},
} as unknown as NarrationResult;

beforeEach(() => clearDeferredDescriptions('g'));

describe('applyNarrationResult', () => {
  it('narrates the surviving steps and drops their held AI descriptions, even when the transcript fails to save', async () => {
    deferDescription('g', 's1', async () => undefined);
    deferDescription('g', 's2', async () => undefined);

    const updates = await applyNarrationResult('g', result);

    expect(updates.map((update) => update.stepId)).toEqual(['s1']);
    expect(takeDeferredDescriptions('g', []).map((held) => held.stepId)).toEqual(['s2']);
  });
});
