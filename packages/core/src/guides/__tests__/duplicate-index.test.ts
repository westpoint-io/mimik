import { describe, expect, it } from 'vitest';
import { duplicateIndex } from '../duplicate-index';
import type { Step } from '../types';

const item = (id: string, blockType?: Step['blockType']): Step => ({
  id,
  guideId: 'g',
  index: 0,
  description: id,
  action: 'click',
  url: '',
  timestamp: 0,
  ...(blockType ? { blockType } : {}),
});

const steps = [item('a'), item('note', 'callout'), item('b'), item('c')];

describe('duplicateIndex', () => {
  it('puts the copy right after the last picked item for below', () => {
    expect(duplicateIndex(steps, new Set(['a', 'b']), 'below')).toBe(3);
  });

  it('puts the copy at the first picked item for above', () => {
    expect(duplicateIndex(steps, new Set(['b', 'c']), 'above')).toBe(2);
  });

  it('counts only numbered steps when a step number is asked for', () => {
    expect(duplicateIndex(steps, new Set(['a']), { step: 2 })).toBe(2);
    expect(duplicateIndex(steps, new Set(['a']), { step: 1 })).toBe(0);
  });

  it('sends a number past the last step to the end and one below 1 to the start', () => {
    expect(duplicateIndex(steps, new Set(['a']), { step: 4 })).toBe(4);
    expect(duplicateIndex(steps, new Set(['a']), { step: 0 })).toBe(0);
  });
});
