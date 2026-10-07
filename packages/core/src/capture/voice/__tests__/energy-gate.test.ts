import { describe, expect, it } from 'vitest';
import {
  detectSpeechByEnergy,
  FRAME_MS,
  MAX_SEGMENT_S,
  SEGMENT_PAD_MS,
  SPEECH_RMS_THRESHOLD,
  SPLIT_SEARCH_S,
} from '../energy-gate';

const SAMPLE_RATE = 16000;
const PAD_S = SEGMENT_PAD_MS / 1000;

function silence(seconds: number): Int16Array {
  return new Int16Array(Math.round(seconds * SAMPLE_RATE));
}

function loud(pcm: Int16Array, fromSeconds: number, toSeconds: number, amplitude = 0.4): Int16Array {
  const from = Math.round(fromSeconds * SAMPLE_RATE);
  const to = Math.round(toSeconds * SAMPLE_RATE);
  for (let i = from; i < to; i += 1) {
    pcm[i] = Math.round(Math.sin((2 * Math.PI * 220 * i) / SAMPLE_RATE) * amplitude * 32767);
  }
  return pcm;
}

describe('SPEECH_RMS_THRESHOLD', () => {
  it('is -45 dBFS', () => {
    expect(SPEECH_RMS_THRESHOLD).toBeCloseTo(10 ** (-45 / 20), 10);
  });
});

describe('detectSpeechByEnergy', () => {
  it('returns nothing for pure silence', async () => {
    expect(await detectSpeechByEnergy(silence(3), SAMPLE_RATE)).toEqual([]);
  });

  it('returns nothing for an empty recording', async () => {
    expect(await detectSpeechByEnergy(new Int16Array(0), SAMPLE_RATE)).toEqual([]);
  });

  it('returns nothing for noise below the threshold', async () => {
    expect(await detectSpeechByEnergy(loud(silence(3), 1, 2, 0.001), SAMPLE_RATE)).toEqual([]);
  });

  it('covers a loud region with one segment', async () => {
    const segments = await detectSpeechByEnergy(loud(silence(5), 2, 3), SAMPLE_RATE);
    expect(segments).toHaveLength(1);
    expect(segments[0]!.start).toBeLessThanOrEqual(2);
    expect(segments[0]!.end).toBeGreaterThanOrEqual(3);
  });

  it('pads the segment on both sides', async () => {
    const [segment] = await detectSpeechByEnergy(loud(silence(5), 2, 3), SAMPLE_RATE);
    expect(segment!.start).toBeCloseTo(2 - PAD_S, 1);
    expect(segment!.end).toBeCloseTo(3 + PAD_S, 1);
  });

  it('keeps two regions separated by a long gap apart', async () => {
    const pcm = loud(loud(silence(8), 0.5, 1.5), 5, 6);
    const segments = await detectSpeechByEnergy(pcm, SAMPLE_RATE);
    expect(segments).toHaveLength(2);
    expect(segments[1]!.start).toBeGreaterThan(segments[0]!.end);
  });

  it('merges two regions whose padding overlaps', async () => {
    const pcm = loud(loud(silence(5), 1, 2), 2.2, 3);
    expect(await detectSpeechByEnergy(pcm, SAMPLE_RATE)).toHaveLength(1);
  });

  it('never pads before the start of the recording', async () => {
    const [segment] = await detectSpeechByEnergy(loud(silence(3), 0, 0.5), SAMPLE_RATE);
    expect(segment!.start).toBe(0);
  });

  it('never pads past the end of the recording', async () => {
    const [segment] = await detectSpeechByEnergy(loud(silence(3), 2.5, 3), SAMPLE_RATE);
    expect(segment!.end).toBe(3);
  });

  it('keeps every segment inside the recording bounds', async () => {
    const pcm = loud(loud(loud(silence(6), 0, 0.4), 2, 2.5), 5.7, 6);
    for (const segment of await detectSpeechByEnergy(pcm, SAMPLE_RATE)) {
      expect(segment.start).toBeGreaterThanOrEqual(0);
      expect(segment.end).toBeLessThanOrEqual(6);
      expect(segment.end).toBeGreaterThan(segment.start);
    }
  });

  it('works at other sample rates', async () => {
    const rate = 48000;
    const pcm = new Int16Array(rate * 4);
    for (let i = rate; i < rate * 2; i += 1)
      pcm[i] = Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 0.4 * 32767);
    const segments = await detectSpeechByEnergy(pcm, rate);
    expect(segments).toHaveLength(1);
    expect(segments[0]!.start).toBeCloseTo(1 - PAD_S, 1);
    expect(segments[0]!.end).toBeCloseTo(2 + PAD_S, 1);
  });

  it('resolves boundaries no coarser than one frame', async () => {
    const [segment] = await detectSpeechByEnergy(loud(silence(4), 1, 2), SAMPLE_RATE);
    expect(Math.abs(segment!.start - (1 - PAD_S))).toBeLessThanOrEqual(FRAME_MS / 1000);
    expect(Math.abs(segment!.end - (2 + PAD_S))).toBeLessThanOrEqual(FRAME_MS / 1000);
  });
});

describe('detectSpeechByEnergy segment cap', () => {
  it('never emits a segment longer than the cap', async () => {
    const segments = await detectSpeechByEnergy(loud(silence(60), 0.5, 59.5), SAMPLE_RATE);
    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments) expect(segment.end - segment.start).toBeLessThanOrEqual(MAX_SEGMENT_S);
  });

  it('leaves a run under the cap as a single segment', async () => {
    const segments = await detectSpeechByEnergy(loud(silence(30), 1, 21), SAMPLE_RATE);
    expect(segments).toHaveLength(1);
    expect(segments[0]!.end - segments[0]!.start).toBeCloseTo(20 + 2 * PAD_S, 1);
  });

  it('cuts at the quietest frame inside the tail of the allowed window', async () => {
    const dip = MAX_SEGMENT_S - SPLIT_SEARCH_S + 1;
    const pcm = loud(loud(silence(40), 0, 40), dip, dip + 0.4, 0.02);
    const [first] = await detectSpeechByEnergy(pcm, SAMPLE_RATE);
    expect(first!.end).toBeGreaterThanOrEqual(dip - FRAME_MS / 1000);
    expect(first!.end).toBeLessThanOrEqual(dip + 0.4);
    expect(MAX_SEGMENT_S - first!.end).toBeGreaterThan(1);
  });

  it('keeps split segments ordered, contiguous and inside the recording', async () => {
    const segments = await detectSpeechByEnergy(loud(silence(60), 0.5, 59.5), SAMPLE_RATE);
    for (const segment of segments) {
      expect(segment.start).toBeGreaterThanOrEqual(0);
      expect(segment.end).toBeLessThanOrEqual(60);
      expect(segment.end).toBeGreaterThan(segment.start);
    }
    for (let i = 1; i < segments.length; i += 1) {
      expect(segments[i]!.start).toBeGreaterThanOrEqual(segments[i - 1]!.end);
    }
  });

  it('caps a segment grown past the cap by overlapping padding', async () => {
    const segments = await detectSpeechByEnergy(loud(loud(silence(50), 1, 21), 21.2, 45), SAMPLE_RATE);
    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments) expect(segment.end - segment.start).toBeLessThanOrEqual(MAX_SEGMENT_S);
  });
});
