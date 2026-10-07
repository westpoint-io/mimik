import { localStorage } from '@/core/env';

export interface AiUse {
  steps: boolean;
  guide: boolean;
}

export async function readAiUse(): Promise<AiUse> {
  const stored = await localStorage.get(['aiForSteps', 'aiForGuide']);
  return { steps: stored.aiForSteps !== false, guide: stored.aiForGuide !== false };
}
