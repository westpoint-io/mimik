import type { VoiceRecording } from './narrate-recording';
import { partialRecording } from './partial-recording';

export class NarrationSlicer {
  private flushedUpTo = 0;

  reset(): void {
    this.flushedUpTo = 0;
  }

  forStep(full: VoiceRecording | null, timestamp: number): VoiceRecording | null {
    if (!full) return null;
    const closesAt = (timestamp - full.audioEpochMs) / 1000;
    const slice = closesAt > this.flushedUpTo ? partialRecording(full, this.flushedUpTo, closesAt) : null;
    if (slice) this.flushedUpTo = closesAt;
    return slice;
  }

  tail(audio: VoiceRecording): VoiceRecording | null {
    return this.flushedUpTo > 0 ? partialRecording(audio, this.flushedUpTo, audio.durationSeconds) : audio;
  }
}
