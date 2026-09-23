import type { Route } from '../types';

export function navigate(route: Route) {
  if (route.page === 'guide') {
    window.location.hash = `#guide/${route.guideId}`;
  } else if (route.category === 'all') {
    window.location.hash = '#library';
  } else {
    window.location.hash = `#library/${route.category}`;
  }
}
