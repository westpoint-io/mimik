import { absoluteSeconds, type Batch, type SpeechSegment } from './types';

const MERGE_GAP_S = 0.5;
export const MAX_BATCH_S = 25;
export const MIN_SPEECH_S = 1;

function joinable(last: SpeechSegment, next: SpeechSegment, gap: number): boolean {
  if (next.start - last.end > gap) return false;
  return next.end <= last.end || next.end - last.start <= MAX_BATCH_S;
}

export function mergeGaps(segments: SpeechSegment[], gap = MERGE_GAP_S): SpeechSegment[] {
  const out: SpeechSegment[] = [];
  for (const s of [...segments].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && joinable(last, s, gap)) {
      last.end = absoluteSeconds(Math.max(last.end, s.end));
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

export interface BatchPlan {
  batches: Batch[];
  dropped: number;
  forcedSplits: number;
}

const speechSeconds = (segments: SpeechSegment[]): number =>
  segments.reduce((total, s) => total + (s.end - s.start), 0);

function capSegment(s: SpeechSegment): SpeechSegment[] {
  const span = s.end - s.start;
  if (span <= MAX_BATCH_S) return [s];
  const parts = Math.ceil(span / MAX_BATCH_S);
  const size = span / parts;
  return Array.from({ length: parts }, (_, i) => ({
    start: absoluteSeconds(s.start + i * size),
    end: absoluteSeconds(i === parts - 1 ? s.end : s.start + (i + 1) * size),
  }));
}

export function buildBatches(segments: SpeechSegment[]): BatchPlan {
  const capped: SpeechSegment[] = [];
  let forcedSplits = 0;
  for (const s of segments) {
    const parts = capSegment(s);
    forcedSplits += parts.length - 1;
    capped.push(...parts);
  }

  const grouped: Batch[] = [];
  for (const s of capped) {
    const last = grouped[grouped.length - 1];
    if (last && s.end - last.start <= MAX_BATCH_S) {
      last.end = s.end;
      last.segments.push(s);
    } else {
      grouped.push({ start: s.start, end: s.end, segments: [s] });
    }
  }
  const batches = grouped.filter((b) => speechSeconds(b.segments) >= MIN_SPEECH_S);
  return { batches, dropped: grouped.length - batches.length, forcedSplits };
}
