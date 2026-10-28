import { describe, expect, it } from 'vitest';
import { moveSteps } from '../move-steps';

const items = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
const order = (list: { id: string }[]) => list.map((item) => item.id).join('');

describe('moveSteps', () => {
  it('moves one item down after the target', () => {
    expect(order(moveSteps(items, ['b'], 'd', true))).toBe('acdbe');
  });
  it('moves one item up before the target', () => {
    expect(order(moveSteps(items, ['d'], 'b', false))).toBe('adbce');
  });
  it('keeps a non-contiguous selection in its order', () => {
    expect(order(moveSteps(items, ['a', 'c'], 'e', true))).toBe('bdeac');
  });
  it('keeps list order when the selection was made out of order', () => {
    expect(order(moveSteps(items, ['c', 'a'], 'e', true))).toBe('bdeac');
  });
  it('moves to the start', () => {
    expect(order(moveSteps(items, ['c'], 'a', false))).toBe('cabde');
  });
  it('moves to the end', () => {
    expect(order(moveSteps(items, ['a'], 'e', true))).toBe('bcdea');
  });
  it('leaves the list alone when dropped on a moving item', () => {
    expect(moveSteps(items, ['b', 'c'], 'c', true)).toBe(items);
  });
  it('leaves the list alone for an unknown target', () => {
    expect(moveSteps(items, ['b'], 'z', true)).toBe(items);
  });
});
