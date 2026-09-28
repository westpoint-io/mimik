export const VOICE_PROGRESS_SHARE = 0.3;

export const MUX_PROGRESS_SHARE = 0.1;

export const exportProgress = {
  narrate(done: number, total: number, share: number): number {
    return total > 0 ? (done / total) * share : 0;
  },
  encode(encoded: number, frames: number, share: number, tail = 0): number {
    return share + (frames > 0 ? encoded / frames : 0) * (1 - share - tail);
  },
  mux(done: number, total: number, tail: number): number {
    return 1 - tail + (total > 0 ? done / total : 0) * tail;
  },
};
