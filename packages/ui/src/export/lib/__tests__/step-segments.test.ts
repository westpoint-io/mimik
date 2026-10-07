import type { VideoChapter } from '@mimik/core/export/video-export';
import { describe, expect, it } from 'vitest';
import { stepSegments } from '../step-segments';

const chapter = (start: number, end: number): VideoChapter => ({
  stepId: `s${start}`,
  title: '',
  kind: 'click',
  start,
  end,
  spoken: false,
});

describe('stepSegments', () => {
  it('sizes each step by its length and fills the ones already played', () => {
    expect(stepSegments([chapter(0, 4), chapter(4, 12), chapter(12, 14)], 8)).toEqual([
      { weight: 4, played: 1 },
      { weight: 8, played: 0.5 },
      { weight: 2, played: 0 },
    ]);
  });
});
