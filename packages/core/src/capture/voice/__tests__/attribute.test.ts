import { describe, expect, it } from 'vitest';
import { assignSegments, makeToAbsolute } from '../attribute';
import { absoluteSeconds, type Batch, type StepWindow } from '../types';

const steps: StepWindow[] = [
  { stepId: 's1', from: absoluteSeconds(0), to: absoluteSeconds(10) },
  { stepId: 's2', from: absoluteSeconds(10), to: absoluteSeconds(20) },
];

const batch = (ranges: [number, number][]): Batch => ({
  start: absoluteSeconds(ranges[0]![0]),
  end: absoluteSeconds(ranges[ranges.length - 1]![1]),
  segments: ranges.map(([start, end]) => ({
    start: absoluteSeconds(start),
    end: absoluteSeconds(end),
  })),
});

const scores = { no_speech_prob: 0.01, avg_logprob: -0.2, compression_ratio: 1.4 };

describe('makeToAbsolute', () => {
  it('maps batch time back across removed silence', () => {
    const toAbs = makeToAbsolute(
      batch([
        [2, 5],
        [15, 18],
      ]),
    );
    expect(toAbs(0)).toBeCloseTo(2);
    expect(toAbs(3)).toBeCloseTo(5);
    expect(toAbs(4)).toBeCloseTo(16);
  });
});

describe('assignSegments', () => {
  const whole = batch([[0, 20]]);

  it('uses a segment verbatim when it sits inside one step', () => {
    const result = assignSegments(
      { segments: [{ start: 1, end: 5, text: 'Open the settings menu.', ...scores }] },
      whole,
      steps,
    );
    expect(result.byStep.get('s1')).toEqual(['Open the settings menu.']);
    expect(result.verbatim).toBe(1);
    expect(result.split).toBe(0);
  });

  it('splits a segment by word when it straddles a step boundary', () => {
    const result = assignSegments(
      {
        segments: [{ start: 8, end: 12, text: 'click edit then save', ...scores }],
        words: [
          { word: 'click', start: 8, end: 8.5 },
          { word: 'edit', start: 9, end: 9.5 },
          { word: 'then', start: 11, end: 11.4 },
          { word: 'save', start: 11.5, end: 12 },
        ],
      },
      whole,
      steps,
    );
    expect(result.byStep.get('s1')).toEqual(['click edit']);
    expect(result.byStep.get('s2')).toEqual(['then save']);
    expect(result.split).toBe(1);
  });

  it('drops a rejected segment entirely', () => {
    const result = assignSegments(
      { segments: [{ start: 1, end: 2, text: 'Thanks for watching!', ...scores }] },
      whole,
      steps,
    );
    expect(result.byStep.size).toBe(0);
    expect(result.rejected).toBe(1);
  });

  it('drops an unscored segment', () => {
    const result = assignSegments({ segments: [{ start: 1, end: 2, text: 'Open settings.' }] }, whole, steps);
    expect(result.byStep.size).toBe(0);
    expect(result.rejected).toBe(1);
  });
});
