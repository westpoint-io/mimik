import { describe, expect, it } from 'vitest';
import { buildBatches, MAX_BATCH_S, mergeGaps } from '../batching';
import { detectSpeechByEnergy } from '../energy-gate';
import { absoluteSeconds, type SpeechSegment } from '../types';

const seg = (start: number, end: number): SpeechSegment => ({
  start: absoluteSeconds(start),
  end: absoluteSeconds(end),
});

describe('mergeGaps', () => {
  it('merges segments separated by a gap at or under the threshold', () => {
    expect(mergeGaps([seg(1, 2), seg(2.4, 3)])).toEqual([seg(1, 3)]);
  });

  it('keeps segments separated by a gap over the threshold', () => {
    expect(mergeGaps([seg(1, 2), seg(2.9, 3)])).toHaveLength(2);
  });

  it('sorts unordered input before merging', () => {
    expect(mergeGaps([seg(5, 6), seg(1, 2)])[0]!.start).toBe(1);
  });

  it('absorbs a segment fully contained in the previous one', () => {
    expect(mergeGaps([seg(1, 5), seg(2, 3)])).toEqual([seg(1, 5)]);
  });

  it('returns an empty array for no input', () => {
    expect(mergeGaps([])).toEqual([]);
  });
});

describe('buildBatches', () => {
  it('groups consecutive segments into one batch when they fit', () => {
    const { batches } = buildBatches([seg(0, 5), seg(6, 10)]);
    expect(batches).toHaveLength(1);
    expect(batches[0]!.segments).toHaveLength(2);
  });

  it('starts a new batch when the span would exceed the cap', () => {
    const { batches } = buildBatches([seg(0, 10), seg(11, 20), seg(21, 40)]);
    expect(batches.length).toBeGreaterThan(1);
    for (const b of batches) expect(b.end - b.start).toBeLessThanOrEqual(MAX_BATCH_S);
  });

  it('never splits an individual segment', () => {
    const input = [seg(0, 4), seg(5, 9)];
    for (const b of buildBatches(input).batches) {
      for (const s of b.segments) expect(input).toContainEqual(s);
    }
  });

  it('drops batches with less than one second of speech and counts them', () => {
    const { batches, dropped } = buildBatches([seg(0, 0.4)]);
    expect(batches).toEqual([]);
    expect(dropped).toBe(1);
  });

  it('reports zero dropped when everything qualifies', () => {
    expect(buildBatches([seg(0, 5)]).dropped).toBe(0);
  });
});

describe('mergeGaps against the cap', () => {
  it('refuses a merge that would push the span over the cap', () => {
    expect(mergeGaps([seg(0, 24), seg(24.2, 30)])).toHaveLength(2);
  });

  it('still absorbs a contained segment when the container is over the cap', () => {
    expect(mergeGaps([seg(0, 40), seg(5, 10)])).toEqual([seg(0, 40)]);
  });
});

describe('buildBatches with an over-long segment', () => {
  it('emits only batches that fit the cap', () => {
    const { batches } = buildBatches([seg(0, 60)]);
    expect(batches.length).toBeGreaterThan(1);
    for (const b of batches) expect(b.end - b.start).toBeLessThanOrEqual(MAX_BATCH_S);
  });

  it('counts every forced split', () => {
    expect(buildBatches([seg(0, 60)]).forcedSplits).toBe(2);
  });

  it('reports no forced splits for conforming segments', () => {
    expect(buildBatches([seg(0, 5), seg(6, 10)]).forcedSplits).toBe(0);
  });

  it('keeps the forced pieces ordered, contiguous and inside the original span', () => {
    const pieces = buildBatches([seg(0, 60)]).batches.flatMap((b) => b.segments);
    expect(pieces[0]!.start).toBe(0);
    expect(pieces[pieces.length - 1]!.end).toBe(60);
    for (let i = 1; i < pieces.length; i += 1) expect(pieces[i]!.start).toBe(pieces[i - 1]!.end);
  });
});

describe('energy gate to batches', () => {
  it('keeps continuous narration under the cap without a forced split', async () => {
    const rate = 16000;
    const pcm = new Int16Array(rate * 60);
    for (let burst = 0, at = 0.5; at < 59; burst += 1) {
      const length = 4 + (burst % 4);
      const to = Math.min(pcm.length, Math.round((at + length) * rate));
      for (let i = Math.round(at * rate); i < to; i += 1) {
        pcm[i] = Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 0.4 * 32767);
      }
      at += length + 0.2 + (burst % 3) * 0.1;
    }
    const { batches, forcedSplits } = buildBatches(mergeGaps(await detectSpeechByEnergy(pcm, rate)));
    expect(batches.length).toBeGreaterThan(1);
    expect(forcedSplits).toBe(0);
    for (const b of batches) expect(b.end - b.start).toBeLessThanOrEqual(MAX_BATCH_S);
  });
});
