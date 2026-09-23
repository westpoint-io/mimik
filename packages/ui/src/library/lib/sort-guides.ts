import type { Guide } from '@mimik/core/guides/types';
import type { SortKey } from '../types';

export function sortGuides(guides: Guide[], sort: SortKey): Guide[] {
  const sorted = [...guides];
  switch (sort) {
    case 'recent':
      return sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    case 'oldest':
      return sorted.sort((a, b) => a.updatedAt - b.updatedAt);
    case 'alpha':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'steps':
      return sorted.sort((a, b) => b.stepIds.length - a.stepIds.length);
  }
}
