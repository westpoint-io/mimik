import type { MicRecording } from './mic-recorder';
import type { VoiceRecording } from './narrate-recording';

export function usableRecording(recording: MicRecording): VoiceRecording | null {
  if (recording.audioEpochMs === null || recording.pcm.length === 0) return null;
  return {
    pcm: recording.pcm,
    sampleRate: recording.sampleRate,
    audioEpochMs: recording.audioEpochMs,
    durationSeconds: recording.durationSeconds,
  };
}
