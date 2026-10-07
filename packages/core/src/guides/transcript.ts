import type { TranscriptLine } from '@/core/capture/voice/types';
import type { GuideTranscript, Step } from './types';

const MS_PER_S = 1000;

export interface TimelineLine extends TranscriptLine {
  atMs: number;
  offsetSeconds: number;
  rowId: string;
  lineIndex: number;
}

export function mergeTranscripts(rows: readonly GuideTranscript[]): TimelineLine[] {
  const lines = rows.flatMap((row) =>
    row.lines.map((line, lineIndex) => ({
      ...line,
      atMs: row.epochMs + line.start * MS_PER_S,
      rowId: row.id,
      lineIndex,
    })),
  );
  lines.sort((a, b) => a.atMs - b.atMs);
  const first = lines[0]?.atMs ?? 0;
  return lines.map((line) => ({ ...line, offsetSeconds: (line.atMs - first) / MS_PER_S }));
}

export function withLiveSteps(lines: readonly TimelineLine[], steps: readonly Step[]): TimelineLine[] {
  const live = new Set(steps.map((step) => step.id));
  return lines.map((line) => (line.stepId && live.has(line.stepId) ? line : { ...line, stepId: null }));
}

export function nearestStepId(lines: readonly TimelineLine[], index: number): string | null {
  for (let i = index + 1; i < lines.length; i++) {
    if (lines[i].stepId) return lines[i].stepId;
  }
  for (let i = index - 1; i >= 0; i--) {
    if (lines[i].stepId) return lines[i].stepId;
  }
  return null;
}

export function formatOffset(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function transcriptToText(lines: readonly TimelineLine[], stepNumbers?: ReadonlyMap<string, number>): string {
  return lines
    .map((line) => {
      const number = line.stepId ? stepNumbers?.get(line.stepId) : undefined;
      const tag = number ? ` [${number}]` : '';
      return `${formatOffset(line.offsetSeconds)}${tag} ${line.text}`;
    })
    .join('\n');
}

export function countUnused(lines: readonly TimelineLine[]): number {
  return lines.filter((line) => !line.stepId).length;
}
