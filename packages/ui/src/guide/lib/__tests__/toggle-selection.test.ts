import { describe, expect, it } from 'vitest';
import { toggleSelection } from '../toggle-selection';

const steps = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

describe('toggleSelection', () => {
  it('toggles a single step on and off', () => {
    const on = toggleSelection(steps, new Set(), null, 'b', false);
    expect([...on]).toEqual(['b']);
    expect([...toggleSelection(steps, on, 'b', 'b', false)]).toEqual([]);
  });
  it('selects the range from the anchor when extending', () => {
    expect([...toggleSelection(steps, new Set(['a']), 'a', 'c', true)]).toEqual(['a', 'b', 'c']);
  });
  it('ranges backwards from the anchor', () => {
    expect([...toggleSelection(steps, new Set(['d']), 'd', 'b', true)]).toEqual(['d', 'b', 'c']);
  });
  it('clears the range when the clicked step was selected', () => {
    expect([...toggleSelection(steps, new Set(['a', 'b', 'c']), 'a', 'c', true)]).toEqual([]);
  });
  it('ignores an anchor that is no longer in the guide', () => {
    expect([...toggleSelection(steps, new Set(), 'gone', 'c', true)]).toEqual(['c']);
  });
});
