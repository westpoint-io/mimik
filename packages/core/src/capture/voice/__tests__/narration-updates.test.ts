import { describe, expect, it } from 'vitest';
import { narrationUpdates } from '../narration-updates';
import type { NarrationResult, NarrationStats } from '../types';

const STATS: NarrationStats = {
  batches: 0,
  failedBatches: 0,
  droppedBatches: 0,
  forcedSplits: 0,
  verbatimSegments: 0,
  splitSegments: 0,
  rejectedSegments: 0,
};

function result(descriptions: NarrationResult['descriptions']): NarrationResult {
  return { descriptions, transcript: { epochMs: 0, lines: [] }, stats: STATS };
}

describe('narrationUpdates', () => {
  it('maps narration onto the steps that own it', () => {
    const updates = narrationUpdates(
      result([
        { stepId: 'a', text: 'Open the settings page' },
        { stepId: 'c', text: 'Save the changes' },
      ]),
      ['a', 'b', 'c'],
    );
    expect(updates).toEqual([
      { stepId: 'a', description: 'Open the settings page' },
      { stepId: 'c', description: 'Save the changes' },
    ]);
  });

  it('produces no update for a step with no narration', () => {
    const updates = narrationUpdates(result([{ stepId: 'b', text: 'Only this one' }]), ['a', 'b', 'c']);
    expect(updates.map((u) => u.stepId)).toEqual(['b']);
  });

  it('returns nothing when there is no narration at all', () => {
    expect(narrationUpdates(result([]), ['a', 'b'])).toEqual([]);
  });

  it('skips narration that is only whitespace', () => {
    expect(narrationUpdates(result([{ stepId: 'a', text: '   \n ' }]), ['a'])).toEqual([]);
  });

  it('trims surrounding whitespace from narration', () => {
    expect(narrationUpdates(result([{ stepId: 'a', text: '  Click save  ' }]), ['a'])).toEqual([
      { stepId: 'a', description: 'Click save' },
    ]);
  });

  it('drops narration for steps that no longer belong to the guide', () => {
    const updates = narrationUpdates(
      result([
        { stepId: 'a', text: 'Kept' },
        { stepId: 'deleted', text: 'Dropped' },
      ]),
      ['a'],
    );
    expect(updates).toEqual([{ stepId: 'a', description: 'Kept' }]);
  });

  it('joins repeated entries for the same step instead of losing speech', () => {
    const updates = narrationUpdates(
      result([
        { stepId: 'a', text: 'First half' },
        { stepId: 'a', text: 'second half' },
      ]),
      ['a'],
    );
    expect(updates).toEqual([{ stepId: 'a', description: 'First half second half' }]);
  });

  it('returns nothing when the guide has no steps', () => {
    expect(narrationUpdates(result([{ stepId: 'a', text: 'Orphan' }]), [])).toEqual([]);
  });
});
