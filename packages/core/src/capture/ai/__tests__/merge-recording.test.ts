import { describe, expect, it, vi } from 'vitest';

const order: string[] = [];

vi.mock('@/core/guides/service', () => ({
  createSnapshot: vi.fn(async () => order.push('snapshot')),
  mergeGuideInto: vi.fn(async () => order.push('merge')),
}));
vi.mock('../settle-descriptions', () => ({ settleDescriptions: vi.fn(async () => order.push('descriptions')) }));

import { mergeGuideInto } from '@/core/guides/service';
import { mergeRecording } from '../merge-recording';

describe('mergeRecording', () => {
  it('waits for the narration and the descriptions before it snapshots and merges', async () => {
    let finishNarration = () => {};
    const narration = new Promise<void>((resolve) => {
      finishNarration = resolve;
    });
    const merging = mergeRecording('staging', { insertTargetGuideId: 'target', insertAtIndex: 2 }, () =>
      narration.then(() => void order.push('narration')),
    );

    await Promise.resolve();
    expect(order).toEqual([]);

    finishNarration();
    await merging;
    expect(order).toEqual(['narration', 'descriptions', 'snapshot', 'merge']);
    expect(mergeGuideInto).toHaveBeenCalledWith('staging', 'target', 2);
  });
});
