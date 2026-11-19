import { describe, expect, it } from 'vitest';
import { highlightSegments } from '../highlight-segments';

describe('highlightSegments', () => {
  it('marks each block in order', () => {
    expect(highlightSegments('a B c D e', ['B', 'D'])).toEqual([
      { key: 'before-0', text: 'a ', marked: false },
      { key: 'block-0', text: 'B', marked: true },
      { key: 'before-1', text: ' c ', marked: false },
      { key: 'block-1', text: 'D', marked: true },
      { key: 'tail', text: ' e', marked: false },
    ]);
  });

  it('returns plain text when a block is missing', () => {
    expect(highlightSegments('own text', ['B'])).toEqual([{ key: 'tail', text: 'own text', marked: false }]);
  });
});
