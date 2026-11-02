import { useEffect, useState } from 'react';
import type { Route } from '../types';

function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  if (h.startsWith('guide/')) {
    const [guideId, query] = h.slice(6).split('?');
    const params = new URLSearchParams(query);
    const copied = params.get('copied');
    if (guideId && copied) {
      window.history.replaceState(null, '', `${window.location.pathname}#guide/${guideId}`);
      return { page: 'guide', guideId, copied: { stepIds: copied.split(','), from: params.get('from') ?? '' } };
    }
    if (guideId) return { page: 'guide', guideId };
  }
  if (h === 'library/starred') return { page: 'library', category: 'starred' };
  if (h === 'library/trash') return { page: 'library', category: 'trash' };
  return { page: 'library', category: 'all' };
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
