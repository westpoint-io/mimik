import { describe, expect, it } from 'vitest';
import type { VoiceRecording } from '../narrate-recording';
import { NarrationSlicer } from '../narration-slicer';

const RATE = 16_000;

function recording(seconds: number): VoiceRecording {
  return { pcm: new Int16Array(seconds * RATE), sampleRate: RATE, audioEpochMs: 1_000, durationSeconds: seconds };
}

describe('NarrationSlicer', () => {
  it('cuts each step its own stretch of audio, from the end of the last one', () => {
    const slicer = new NarrationSlicer();

    expect(slicer.forStep(recording(10), 1_000 + 4_000)?.durationSeconds).toBe(4);
    expect(slicer.forStep(recording(10), 1_000 + 9_000)?.durationSeconds).toBe(5);
  });

  it('gives a step nothing when no audio has arrived since the last cut', () => {
    const slicer = new NarrationSlicer();
    slicer.forStep(recording(10), 1_000 + 6_000);

    expect(slicer.forStep(recording(10), 1_000 + 6_000)).toBeNull();
    expect(slicer.forStep(null, 1_000 + 8_000)).toBeNull();
  });

  it('leaves the tail after the last cut for Stop, or the whole recording when nothing was cut', () => {
    const slicer = new NarrationSlicer();
    expect(slicer.tail(recording(10))?.durationSeconds).toBe(10);

    slicer.forStep(recording(10), 1_000 + 7_000);
    expect(slicer.tail(recording(10))?.durationSeconds).toBe(3);

    slicer.reset();
    expect(slicer.tail(recording(10))?.durationSeconds).toBe(10);
  });
});
