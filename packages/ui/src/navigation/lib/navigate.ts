import type { Route } from '../types';
import { guideHash } from './guide-hash';

export function navigate(route: Route) {
  if (route.page === 'guide') {
    window.location.hash = guideHash(route);
  } else if (route.category === 'all') {
    window.location.hash = '#library';
  } else {
    window.location.hash = `#library/${route.category}`;
  }
}
