import { describe, expect, it } from 'vitest';
import { type PlacedClip, voiceTrackPieces } from '@/core/export/voiceover/audio';

const RATE = 100;

const clip = (startSec: number, samples: number): PlacedClip => ({
  startSec,
  buffer: { length: samples } as AudioBuffer,
});

const layout = (pieces: ReturnType<typeof voiceTrackPieces>) =>
  pieces.map((piece) => (piece.kind === 'clip' ? `clip:${piece.buffer.length}` : `gap:${piece.samples}`));

describe('voiceTrackPieces', () => {
  it('pads to each clip and out to the end of the video', () => {
    expect(layout(voiceTrackPieces([clip(1, 50)], 3, RATE))).toEqual(['gap:100', 'clip:50', 'gap:150']);
  });

  it('measures gaps from absolute positions, so rounding cannot accumulate', () => {
    const pieces = voiceTrackPieces([clip(0.333, 10), clip(0.666, 10), clip(0.999, 10)], 2, RATE);
    const total = pieces.reduce((sum, p) => sum + (p.kind === 'clip' ? p.buffer.length : p.samples), 0);
    expect(total).toBe(200);
    expect(layout(pieces)).toEqual(['gap:33', 'clip:10', 'gap:24', 'clip:10', 'gap:23', 'clip:10', 'gap:90']);
  });

  it('never cuts a clip that outruns its slot', () => {
    const pieces = voiceTrackPieces([clip(0, 250), clip(1, 50)], 4, RATE);
    expect(layout(pieces)).toEqual(['clip:250', 'clip:50', 'gap:100']);
  });

  it('is pure silence when nothing was narrated', () => {
    expect(layout(voiceTrackPieces([], 2, RATE))).toEqual(['gap:200']);
  });

  it('orders clips by their place on the clock, not by the map they came from', () => {
    expect(layout(voiceTrackPieces([clip(2, 10), clip(1, 20)], 3, RATE))).toEqual([
      'gap:100',
      'clip:20',
      'gap:80',
      'clip:10',
      'gap:90',
    ]);
  });
});
