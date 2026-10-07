import { type RefObject, useEffect, useState } from 'react';
import type { LibraryDisplay } from '../types';

const MIN_CARD_WIDTH = 300;
const MAX_COLUMNS = 6;
const CARD_GAP = 18;
const CARD_BODY = 113;
const ROW_GAP = 10;
const ROW_HEIGHT = 94;
const PAGER = 64;
const lastFit = { current: { columns: 3, pageSize: 6 } };

export function usePageFit(
  ref: RefObject<HTMLElement | null>,
  display: LibraryDisplay,
): { columns: number; pageSize: number } {
  const [fit, setFit] = useState(lastFit.current);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const width = node.clientWidth;
      const grid = display === 'grid';
      const columns = grid
        ? Math.min(MAX_COLUMNS, Math.max(1, Math.floor((width + CARD_GAP) / (MIN_CARD_WIDTH + CARD_GAP))))
        : 1;
      const gap = grid ? CARD_GAP : ROW_GAP;
      const itemHeight = grid ? ((width - CARD_GAP * (columns - 1)) / columns) * (9 / 16) + CARD_BODY : ROW_HEIGHT;
      const top = node.getBoundingClientRect().top + window.scrollY;
      const bottom = Number.parseFloat(getComputedStyle(node.parentElement ?? node).paddingBottom) || 0;
      const room = window.innerHeight - top - bottom - PAGER;
      const rows = Math.max(1, Math.floor((room + gap) / (itemHeight + gap)));
      const next = { columns, pageSize: columns * rows };
      if (next.columns === lastFit.current.columns && next.pageSize === lastFit.current.pageSize) return;
      lastFit.current = next;
      setFit(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [ref, display]);

  return fit;
}
