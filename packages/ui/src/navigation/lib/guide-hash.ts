import type { Route } from '../types';

export function guideHash({ guideId, copied }: Extract<Route, { page: 'guide' }>): string {
  if (!copied) return `#guide/${guideId}`;
  return `#guide/${guideId}?${new URLSearchParams({ copied: copied.stepIds.join(','), from: copied.from })}`;
}
