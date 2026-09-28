import { rejectReason } from './filter';
import {
  type AbsoluteSeconds,
  absoluteSeconds,
  type Batch,
  type StepWindow,
  type TranscriptionResponse,
  type TranscriptLine,
} from './types';

export function makeToAbsolute(batch: Batch): (batchTime: number) => AbsoluteSeconds {
  const bounds: { offset: number; start: number; length: number }[] = [];
  let elapsed = 0;
  for (const s of batch.segments) {
    bounds.push({ offset: elapsed, start: s.start, length: s.end - s.start });
    elapsed += s.end - s.start;
  }
  return (batchTime) => {
    for (const b of bounds) {
      if (batchTime <= b.offset + b.length) {
        return absoluteSeconds(b.start + (batchTime - b.offset));
      }
    }
    const last = bounds[bounds.length - 1];
    return absoluteSeconds(last ? last.start + last.length : batchTime);
  };
}

export interface AssignResult {
  byStep: Map<string, string[]>;
  lines: TranscriptLine[];
  verbatim: number;
  split: number;
  rejected: number;
}

interface WordGroup {
  stepId: string;
  words: string[];
  start: number;
  end: number;
}

export function assignSegments(response: TranscriptionResponse, batch: Batch, steps: StepWindow[]): AssignResult {
  const toAbsolute = makeToAbsolute(batch);
  const byStep = new Map<string, string[]>();
  const lines: TranscriptLine[] = [];
  const add = (stepId: string, text: string) => {
    if (!text) return;
    const existing = byStep.get(stepId);
    if (existing) existing.push(text);
    else byStep.set(stepId, [text]);
  };
  const record = (line: TranscriptLine) => {
    if (line.text) lines.push(line);
  };

  let verbatim = 0;
  let split = 0;
  let rejected = 0;

  for (const segment of response.segments ?? []) {
    const start = toAbsolute(segment.start);
    const end = toAbsolute(segment.end);
    const text = (segment.text ?? '').trim();
    const reason = rejectReason(segment);

    if (reason) {
      rejected += 1;
      record({ start, end, text, stepId: null, rejectReason: reason });
      continue;
    }

    const spanned = steps.filter((s) => start < s.to && end > s.from);

    if (spanned.length <= 1) {
      const step = spanned[0] ?? steps.find((s) => start >= s.from && start <= s.to);
      if (step) {
        add(step.stepId, text);
        verbatim += 1;
      }
      record({ start, end, text, stepId: step?.stepId ?? null, rejectReason: null });
      continue;
    }

    split += 1;
    const grouped = new Map<string, WordGroup>();
    for (const word of response.words ?? []) {
      if (word.start < segment.start || word.start > segment.end) continue;
      const at = toAbsolute(word.start);
      const step = steps.find((s) => at >= s.from && at <= s.to) ?? spanned[spanned.length - 1];
      const existing = grouped.get(step.stepId);
      if (existing) {
        existing.words.push(word.word.trim());
        existing.end = Math.max(existing.end, toAbsolute(word.end));
      } else {
        grouped.set(step.stepId, {
          stepId: step.stepId,
          words: [word.word.trim()],
          start: at,
          end: toAbsolute(word.end),
        });
      }
    }

    if (grouped.size === 0) {
      record({ start, end, text, stepId: null, rejectReason: null });
      continue;
    }

    for (const group of [...grouped.values()].sort((a, b) => a.start - b.start)) {
      const joined = group.words.join(' ').trim();
      add(group.stepId, joined);
      record({ start: group.start, end: group.end, text: joined, stepId: group.stepId, rejectReason: null });
    }
  }

  return { byStep, lines, verbatim, split, rejected };
}
