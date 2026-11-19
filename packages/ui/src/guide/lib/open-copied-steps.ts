import { client } from '@mimik/core/env';
import { tabs } from '../../env';
import { guideHash } from '../../navigation/lib/guide-hash';
import { navigate } from '../../navigation/lib/navigate';
import type { Route } from '../../navigation/types';

export function openCopiedSteps(route: Extract<Route, { page: 'guide' }>): void {
  if (client() === 'desktop') {
    navigate(route);
    return;
  }
  void tabs.create(`${window.location.origin}${window.location.pathname}${guideHash(route)}`);
}
