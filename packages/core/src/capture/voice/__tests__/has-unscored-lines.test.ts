import { describe, expect, it } from 'vitest';
import { hasUnscoredLines } from '../has-unscored-lines';
import type { TranscriptLine } from '../types';

const line = (rejectReason: string | null): TranscriptLine => ({
  start: 0,
  end: 1,
  text: 'hello',
  stepId: null,
  rejectReason,
});
const result = (...lines: TranscriptLine[]) => ({ transcript: { epochMs: 0, lines } });

describe('hasUnscoredLines', () => {
  it('spots a segment dropped for lacking scores', () => {
    expect(hasUnscoredLines(result(line('empty'), line('unscored')))).toBe(true);
  });

  it('ignores segments dropped for other reasons or kept', () => {
    expect(hasUnscoredLines(result(line('no_speech_prob=0.9'), line(null)))).toBe(false);
    expect(hasUnscoredLines(result())).toBe(false);
  });
});
