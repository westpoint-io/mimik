import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type PlacedClip, voiceTrackPieces, writeVoiceTrack } from '@/core/export/voiceover/audio';

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

describe('writeVoiceTrack', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'OfflineAudioContext',
      class {
        createBuffer(_channels: number, length: number) {
          return { length };
        }
      },
    );
  });

  it('reports a step per piece, so the bar can move while the track is written', async () => {
    const seen: [number, number][] = [];
    await writeVoiceTrack(
      [clip(1, 50)],
      3,
      async () => {},
      RATE,
      (done, total) => seen.push([done, total]),
    );

    expect(seen).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('ends on a full count, so the bar lands on 100%', async () => {
    const seen: [number, number][] = [];
    await writeVoiceTrack(
      [],
      2,
      async () => {},
      RATE,
      (done, total) => seen.push([done, total]),
    );

    expect(seen.at(-1)?.[0]).toBe(seen.at(-1)?.[1]);
  });

  it('writes the track without a progress callback at all', async () => {
    const written: number[] = [];
    await writeVoiceTrack([clip(1, 50)], 3, async (b) => void written.push(b.length), RATE);

    expect(written).toEqual([100, 50, 150]);
  });
});
