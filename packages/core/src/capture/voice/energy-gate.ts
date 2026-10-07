import { MAX_BATCH_S } from './batching';
import { absoluteSeconds, type SpeechSegment } from './types';

export const FRAME_MS = 30;
export const SEGMENT_PAD_MS = 300;
export const SPEECH_RMS_THRESHOLD = 10 ** (-45 / 20);
export const MAX_SEGMENT_S = MAX_BATCH_S;
export const SPLIT_SEARCH_S = 3;

const MS_PER_S = 1000;
const INT16_SCALE = 32768;

function frameRms(pcm: Int16Array, from: number, to: number): number {
  if (to <= from) return 0;
  let sum = 0;
  for (let i = from; i < to; i += 1) {
    const sample = pcm[i]! / INT16_SCALE;
    sum += sample * sample;
  }
  return Math.sqrt(sum / (to - from));
}

export async function detectSpeechByEnergy(pcm: Int16Array, sampleRate: number): Promise<SpeechSegment[]> {
  if (pcm.length === 0 || sampleRate <= 0) return [];

  const frameSize = Math.max(1, Math.round((sampleRate * FRAME_MS) / MS_PER_S));
  const frameSeconds = frameSize / sampleRate;
  const duration = pcm.length / sampleRate;
  const pad = SEGMENT_PAD_MS / MS_PER_S;

  const rms: number[] = [];
  for (let frameStart = 0; frameStart < pcm.length; frameStart += frameSize) {
    rms.push(frameRms(pcm, frameStart, Math.min(frameStart + frameSize, pcm.length)));
  }

  const runs: { start: number; end: number }[] = [];
  const push = (fromSample: number, toSample: number) => {
    const start = Math.max(0, fromSample / sampleRate - pad);
    const end = Math.min(duration, toSample / sampleRate + pad);
    const last = runs[runs.length - 1];
    if (last && start <= last.end) {
      last.end = Math.max(last.end, end);
      return;
    }
    runs.push({ start, end });
  };

  let voicedFrom = -1;
  for (let frame = 0; frame < rms.length; frame += 1) {
    const frameStart = frame * frameSize;
    const voiced = rms[frame]! > SPEECH_RMS_THRESHOLD;
    if (voiced && voicedFrom < 0) voicedFrom = frameStart;
    if (!voiced && voicedFrom >= 0) {
      push(voicedFrom, frameStart);
      voicedFrom = -1;
    }
  }
  if (voicedFrom >= 0) push(voicedFrom, pcm.length);

  const quietestCut = (start: number, limit: number): number => {
    const firstFrame = Math.max(1, Math.ceil((limit - SPLIT_SEARCH_S) / frameSeconds));
    const lastFrame = Math.min(rms.length - 1, Math.floor(limit / frameSeconds));
    let cut = limit;
    let quietest = Number.POSITIVE_INFINITY;
    for (let frame = firstFrame; frame <= lastFrame; frame += 1) {
      if (rms[frame]! >= quietest) continue;
      quietest = rms[frame]!;
      cut = frame * frameSeconds;
    }
    return cut > start ? cut : limit;
  };

  const segments: SpeechSegment[] = [];
  for (const run of runs) {
    let start = run.start;
    while (run.end - start > MAX_SEGMENT_S) {
      const cut = quietestCut(start, start + MAX_SEGMENT_S);
      segments.push({ start: absoluteSeconds(start), end: absoluteSeconds(cut) });
      start = cut;
    }
    segments.push({ start: absoluteSeconds(start), end: absoluteSeconds(run.end) });
  }

  return segments;
}
