import { isBlock } from './blocks';
import type { Step } from './types';

export type DuplicatePlace = 'below' | 'above' | { step: number };

export function duplicateIndex(steps: readonly Step[], picked: ReadonlySet<string>, place: DuplicatePlace): number {
  const isPicked = (step: Step) => picked.has(step.id);
  if (place === 'below') return steps.findLastIndex(isPicked) + 1;
  if (place === 'above') return Math.max(0, steps.findIndex(isPicked));
  if (place.step < 1) return 0;
  const numbered = steps.flatMap((step, index) => (isBlock(step) ? [] : [index]));
  return numbered[place.step - 1] ?? steps.length;
}
