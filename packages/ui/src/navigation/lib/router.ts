import { useEffect, useState } from 'react';

export type Route =
  | { page: 'library'; category: 'all' | 'starred' | 'trash' }
  | {
      page: 'guide';
      guideId: string;
      stepId?: string;
      tool?: 'annotate' | 'redact' | 'crop' | 'target';
    };

function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  if (h.startsWith('guide/')) {
    const guideId = h.slice(6);
    if (guideId) return { page: 'guide', guideId };
  }
  if (h === 'library/starred') return { page: 'library', category: 'starred' };
  if (h === 'library/trash') return { page: 'library', category: 'trash' };
  return { page: 'library', category: 'all' };
}

export function navigate(route: Route) {
  if (route.page === 'guide') {
    window.location.hash = `#guide/${route.guideId}`;
  } else if (route.category === 'all') {
    window.location.hash = '#library';
  } else {
    window.location.hash = `#library/${route.category}`;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => {
    const params = new URLSearchParams(window.location.search);
    const guideId = params.get('guideId');
    if (guideId) {
      const stepId = params.get('stepId') ?? undefined;
      const toolParam = params.get('tool');
      const tool =
        toolParam === 'annotate' || toolParam === 'redact' || toolParam === 'crop' || toolParam === 'target'
          ? toolParam
          : undefined;
      window.history.replaceState(null, '', `${window.location.pathname}#guide/${guideId}`);
      return { page: 'guide', guideId, stepId, tool };
    }
    return parseHash(window.location.hash);
  });

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return route;
}
