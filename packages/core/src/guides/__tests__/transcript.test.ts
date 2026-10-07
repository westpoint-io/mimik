import { describe, expect, it } from 'vitest';
import { countUnused, formatOffset, mergeTranscripts, nearestStepId, transcriptToText } from '../transcript';
import type { GuideTranscript } from '../types';

const EPOCH = 1_700_000_000_000;

function row(epochOffsetMs: number, lines: Array<[number, string, string | null]>): GuideTranscript {
  return {
    id: `t-${epochOffsetMs}`,
    guideId: 'g1',
    epochMs: EPOCH + epochOffsetMs,
    createdAt: 0,
    lines: lines.map(([start, text, stepId]) => ({ start, end: start + 1, text, stepId, rejectReason: null })),
  };
}

describe('mergeTranscripts', () => {
  it('orders lines from separate slices by when they were spoken', () => {
    const lines = mergeTranscripts([
      row(30_000, [[2, 'and then save', 's3']]),
      row(0, [
        [1, 'first open settings', 's1'],
        [5, 'scroll down a bit', 's2'],
      ]),
    ]);

    expect(lines.map((line) => line.text)).toEqual(['first open settings', 'scroll down a bit', 'and then save']);
  });

  it('measures the offset from the earliest slice, not from each slice', () => {
    const lines = mergeTranscripts([row(0, [[1, 'first', 's1']]), row(30_000, [[2, 'later', 's2']])]);
    expect(lines.map((line) => line.offsetSeconds)).toEqual([0, 31]);
  });

  it('has nothing to merge when no slice was stored', () => {
    expect(mergeTranscripts([])).toEqual([]);
  });
});

describe('nearestStepId', () => {
  const lines = mergeTranscripts([
    row(0, [
      [1, 'thinking out loud', null],
      [3, 'now I click save', 's2'],
      [6, 'and now the dialog', 's3'],
    ]),
  ]);

  it('looks forward first, because narration comes before the action it describes', () => {
    expect(nearestStepId(lines, 0)).toBe('s2');
  });

  it('still looks forward when a step sits on either side of the stray line', () => {
    const between = mergeTranscripts([
      row(0, [
        [1, 'click save', 's1'],
        [3, 'stray thought', null],
        [5, 'now the dialog', 's3'],
      ]),
    ]);
    expect(nearestStepId(between, 1)).toBe('s3');
  });

  it('falls back to the step before when nothing follows', () => {
    const trailing = mergeTranscripts([
      row(0, [
        [1, 'click save', 's1'],
        [4, 'that is everything', null],
      ]),
    ]);
    expect(nearestStepId(trailing, 1)).toBe('s1');
  });

  it('has nowhere to put a line when no line was attributed at all', () => {
    const orphans = mergeTranscripts([row(0, [[1, 'hello?', null]])]);
    expect(nearestStepId(orphans, 0)).toBeNull();
  });
});

describe('countUnused', () => {
  it('counts only the lines no step took', () => {
    const lines = mergeTranscripts([
      row(0, [
        [1, 'kept', 's1'],
        [3, 'dropped', null],
        [5, 'also dropped', null],
      ]),
    ]);
    expect(countUnused(lines)).toBe(2);
  });
});

describe('transcriptToText', () => {
  it('stamps each line with its time and the step that used it', () => {
    const lines = mergeTranscripts([
      row(0, [
        [1, 'open settings', 's1'],
        [65, 'stray thought', null],
      ]),
    ]);

    expect(transcriptToText(lines, new Map([['s1', 4]]))).toBe('0:00 [4] open settings\n1:04 stray thought');
  });
});

describe('formatOffset', () => {
  it('pads seconds and rolls over into minutes', () => {
    expect(formatOffset(0)).toBe('0:00');
    expect(formatOffset(9.9)).toBe('0:09');
    expect(formatOffset(61)).toBe('1:01');
    expect(formatOffset(-5)).toBe('0:00');
  });
});
