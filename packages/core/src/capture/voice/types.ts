declare const secondsBrand: unique symbol;

export type AbsoluteSeconds = number & { readonly [secondsBrand]: 'absolute' };

export function absoluteSeconds(value: number): AbsoluteSeconds {
  return value as AbsoluteSeconds;
}

export interface SpeechSegment {
  start: AbsoluteSeconds;
  end: AbsoluteSeconds;
}

export interface StepWindow {
  stepId: string;
  from: AbsoluteSeconds;
  to: AbsoluteSeconds;
}

export interface Batch {
  start: AbsoluteSeconds;
  end: AbsoluteSeconds;
  segments: SpeechSegment[];
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  no_speech_prob?: number;
  avg_logprob?: number;
  compression_ratio?: number;
}

export interface ScoredTranscriptSegment extends TranscriptSegment {
  no_speech_prob: number;
  avg_logprob: number;
  compression_ratio: number;
}

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface PositionedWord {
  text: string;
  batchStart: number;
  start: AbsoluteSeconds;
  end: AbsoluteSeconds;
}

export interface TranscriptionResponse {
  text?: string;
  segments?: TranscriptSegment[];
  words?: TranscriptWord[];
}

export interface NarrationStats {
  batches: number;
  failedBatches: number;
  droppedBatches: number;
  forcedSplits: number;
  verbatimSegments: number;
  splitSegments: number;
  rejectedSegments: number;
}

export interface TranscriptLine {
  start: number;
  end: number;
  text: string;
  stepId: string | null;
  rejectReason: string | null;
  addedByHand?: boolean;
}

export interface NarrationTranscript {
  epochMs: number;
  lines: TranscriptLine[];
}

export interface NarrationResult {
  descriptions: Array<{ stepId: string; text: string }>;
  transcript: NarrationTranscript;
  stats: NarrationStats;
}
