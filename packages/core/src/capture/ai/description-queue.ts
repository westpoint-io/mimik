import PQueue from 'p-queue';
import { logger } from '@/core/logger';

const DRAIN_TIMEOUT_MS = 20000;
const TASK_TIMEOUT_MS = 45000;

const queue = new PQueue({ concurrency: 1 });
const byGuide = new Map<string, Set<Promise<unknown>>>();

export function queueDescription(guideId: string, run: () => Promise<void>): void {
  const pending = queue
    .add(run, { timeout: TASK_TIMEOUT_MS })
    .catch((err) => logger.error('AI description failed', err));

  const tracked = byGuide.get(guideId) ?? new Set<Promise<unknown>>();
  tracked.add(pending);
  byGuide.set(guideId, tracked);

  pending.finally(() => {
    tracked.delete(pending);
    if (tracked.size === 0) byGuide.delete(guideId);
  });
}

export async function drainDescriptions(guideId: string): Promise<void> {
  const tracked = byGuide.get(guideId);
  if (!tracked?.size) return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.allSettled([...tracked]),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, DRAIN_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
