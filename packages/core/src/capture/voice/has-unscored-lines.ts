import type { NarrationResult } from './types';

export function hasUnscoredLines(result: Pick<NarrationResult, 'transcript'>): boolean {
  return result.transcript.lines.some((line) => line.rejectReason === 'unscored');
}
