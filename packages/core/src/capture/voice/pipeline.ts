import { assignSegments } from './attribute';
import { buildBatches, mergeGaps } from './batching';
import type { NarrationResult, SpeechSegment, StepWindow, TranscriptionResponse, TranscriptLine } from './types';
import { encodeWav } from './wav';

export interface PipelineInput {
  pcm: Int16Array;
  sampleRate: number;
  steps: StepWindow[];
  audioEpochMs?: number;
  detectSpeech: (pcm: Int16Array, sampleRate: number) => Promise<SpeechSegment[]>;
  transcribe: (wav: Blob) => Promise<TranscriptionResponse>;
}

function sliceSpeech(pcm: Int16Array, segments: SpeechSegment[], sampleRate: number): Int16Array {
  const parts = segments.map((s) =>
    pcm.subarray(Math.max(0, Math.floor(s.start * sampleRate)), Math.min(pcm.length, Math.ceil(s.end * sampleRate))),
  );
  const out = new Int16Array(parts.reduce((total, p) => total + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export async function runNarrationPipeline(input: PipelineInput): Promise<NarrationResult> {
  const { pcm, sampleRate, steps, audioEpochMs, detectSpeech, transcribe } = input;
  const { batches, dropped, forcedSplits } = buildBatches(mergeGaps(await detectSpeech(pcm, sampleRate)));

  const collected = new Map<string, string[]>();
  const lines: TranscriptLine[] = [];
  const stats = {
    batches: batches.length,
    failedBatches: 0,
    droppedBatches: dropped,
    forcedSplits,
    verbatimSegments: 0,
    splitSegments: 0,
    rejectedSegments: 0,
  };

  for (const batch of batches) {
    let response: TranscriptionResponse;
    try {
      response = await transcribe(encodeWav(sliceSpeech(pcm, batch.segments, sampleRate), sampleRate));
    } catch {
      stats.failedBatches += 1;
      continue;
    }
    const assigned = assignSegments(response, batch, steps);
    lines.push(...assigned.lines);
    stats.verbatimSegments += assigned.verbatim;
    stats.splitSegments += assigned.split;
    stats.rejectedSegments += assigned.rejected;
    for (const [stepId, texts] of assigned.byStep) {
      const existing = collected.get(stepId);
      if (existing) existing.push(...texts);
      else collected.set(stepId, [...texts]);
    }
  }

  const descriptions: NarrationResult['descriptions'] = [];
  for (const [stepId, texts] of collected) {
    const text = texts.join(' ').trim();
    if (text) descriptions.push({ stepId, text });
  }

  lines.sort((a, b) => a.start - b.start);

  return { descriptions, transcript: { epochMs: audioEpochMs ?? 0, lines }, stats };
}
