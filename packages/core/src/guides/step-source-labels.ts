import type { DescriptionSource } from './types';

export const STEP_SOURCE_LABELS: Record<DescriptionSource, string> = {
  ai: 'stepSource.ai',
  narration: 'stepSource.voice',
  heuristic: 'stepSource.basic',
  manual: 'stepSource.edited',
};
