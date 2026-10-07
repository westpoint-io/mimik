import { describe, expect, it } from 'vitest';
import { exportProgress, MUX_PROGRESS_SHARE, VOICE_PROGRESS_SHARE } from '../export-progress';

describe('VOICE_PROGRESS_SHARE', () => {
  it('leaves narration a visible head of the bar and encoding the majority', () => {
    expect(VOICE_PROGRESS_SHARE).toBe(0.3);
  });
});

describe('exportProgress.narrate', () => {
  it('fills only the head of the bar, since encoding still has to run', () => {
    expect(exportProgress.narrate(0, 10, 0.3)).toBe(0);
    expect(exportProgress.narrate(5, 10, 0.3)).toBeCloseTo(0.15, 6);
    expect(exportProgress.narrate(10, 10, 0.3)).toBeCloseTo(0.3, 6);
  });

  it('stays at zero when there is nothing to synthesise, rather than dividing by zero', () => {
    expect(exportProgress.narrate(0, 0, 0.3)).toBe(0);
  });
});

describe('MUX_PROGRESS_SHARE', () => {
  it('keeps a slice back for writing the audio track, which runs after the last frame', () => {
    expect(MUX_PROGRESS_SHARE).toBe(0.1);
  });
});

describe('exportProgress.encode', () => {
  it('starts where narration left off so the bar never goes backwards', () => {
    expect(exportProgress.encode(0, 300, 0.3)).toBeCloseTo(0.3, 6);
    expect(exportProgress.encode(150, 300, 0.3)).toBeCloseTo(0.65, 6);
    expect(exportProgress.encode(300, 300, 0.3)).toBeCloseTo(1, 6);
  });

  it('owns the whole bar when nothing was narrated', () => {
    expect(exportProgress.encode(0, 300, 0)).toBe(0);
    expect(exportProgress.encode(150, 300, 0)).toBeCloseTo(0.5, 6);
    expect(exportProgress.encode(300, 300, 0)).toBeCloseTo(1, 6);
  });

  it('stops short of the end when an audio track still has to be written', () => {
    expect(exportProgress.encode(300, 300, 0.3, 0.1)).toBeCloseTo(0.9, 6);
    expect(exportProgress.encode(150, 300, 0.3, 0.1)).toBeCloseTo(0.6, 6);
  });
});

describe('exportProgress.mux', () => {
  it('fills the tail the encode left behind', () => {
    expect(exportProgress.mux(0, 40, 0.1)).toBeCloseTo(0.9, 6);
    expect(exportProgress.mux(20, 40, 0.1)).toBeCloseTo(0.95, 6);
    expect(exportProgress.mux(40, 40, 0.1)).toBeCloseTo(1, 6);
  });

  it('picks up exactly where a narrated encode stopped', () => {
    expect(exportProgress.mux(0, 40, 0.1)).toBeCloseTo(exportProgress.encode(300, 300, 0.3, 0.1), 6);
  });
});
