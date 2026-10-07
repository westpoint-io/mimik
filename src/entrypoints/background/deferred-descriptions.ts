import type { Describe } from '@/core/capture/write-step';

export interface DeferredDescription {
  stepId: string;
  describe: Describe;
}

const deferred = new Map<string, Map<string, Describe>>();

export function deferDescription(guideId: string, stepId: string, describe: Describe): void {
  const forGuide = deferred.get(guideId) ?? new Map<string, Describe>();
  forGuide.set(stepId, describe);
  deferred.set(guideId, forGuide);
}

export function takeDeferredDescription(guideId: string, stepId: string): Describe | undefined {
  const forGuide = deferred.get(guideId);
  if (!forGuide) return undefined;
  const describe = forGuide.get(stepId);
  forGuide.delete(stepId);
  return describe;
}

export function takeDeferredDescriptions(guideId: string, narratedStepIds: readonly string[]): DeferredDescription[] {
  const forGuide = deferred.get(guideId);
  if (!forGuide) return [];
  deferred.delete(guideId);

  const narrated = new Set(narratedStepIds);
  return [...forGuide].filter(([stepId]) => !narrated.has(stepId)).map(([stepId, describe]) => ({ stepId, describe }));
}

export function discardDeferred(guideId: string, stepIds: readonly string[]): void {
  const forGuide = deferred.get(guideId);
  if (!forGuide) return;
  for (const stepId of stepIds) forGuide.delete(stepId);
}

export function clearDeferredDescriptions(guideId: string): void {
  deferred.delete(guideId);
}
