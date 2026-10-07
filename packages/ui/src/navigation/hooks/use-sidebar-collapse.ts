import { useState, useSyncExternalStore } from 'react';
import { useFullview } from '../../stores/use-fullview';

const COLLAPSED_KEY = 'mimik-sidebar-collapsed';
const NARROW = '(max-width: 1099px)';

function watchNarrow(notify: () => void): () => void {
  const query = matchMedia(NARROW);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
}

export function useSidebarCollapse(): { collapsed: boolean; toggle: () => void } {
  const historyOpen = useFullview((s) => s.historyOpen);
  const narrow = useSyncExternalStore(watchNarrow, () => matchMedia(NARROW).matches);
  const [choice, setChoice] = useState<'open' | 'collapsed' | null>(() =>
    localStorage.getItem(COLLAPSED_KEY) ? 'collapsed' : null,
  );
  const collapsed = choice === 'collapsed' || (choice !== 'open' && (historyOpen || narrow));

  const toggle = () => {
    if (collapsed) localStorage.removeItem(COLLAPSED_KEY);
    else localStorage.setItem(COLLAPSED_KEY, '1');
    setChoice(collapsed ? 'open' : 'collapsed');
  };

  return { collapsed, toggle };
}
