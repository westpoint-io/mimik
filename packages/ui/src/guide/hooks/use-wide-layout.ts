import { useSyncExternalStore } from 'react';

const WIDE = '(min-width: 1280px)';

function watchWide(notify: () => void): () => void {
  const query = matchMedia(WIDE);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
}

export function useWideLayout(): boolean {
  return useSyncExternalStore(watchWide, () => matchMedia(WIDE).matches);
}
