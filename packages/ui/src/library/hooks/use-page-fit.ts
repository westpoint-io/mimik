import { type RefObject, useEffect, useState } from 'react';
import type { LibraryDisplay } from '../types';

const MIN_CARD_WIDTH = 240;
const MAX_COLUMNS = 6;
const MIN_THUMB_RATIO = 0.36;
const MAX_THUMB_RATIO = 9 / 16;
const SNUG = 0.04;
const CARD_GAP = 18;
const CARD_BODY = 113;
const ROW_GAP = 10;
const ROW_HEIGHT = 94;
const PAGER = 64;
type PageFit = { columns: number; pageSize: number; thumbHeight: number | null };
const lastFit: { current: PageFit } = { current: { columns: 3, pageSize: 6, thumbHeight: null } };

export function usePageFit(ref: RefObject<HTMLElement | null>, display: LibraryDisplay): PageFit {
  const [fit, setFit] = useState(lastFit.current);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const width = node.clientWidth;
      const top = node.getBoundingClientRect().top + window.scrollY;
      const bottom = Number.parseFloat(getComputedStyle(node.parentElement ?? node).paddingBottom) || 0;
      const room = window.innerHeight - top - bottom - PAGER;
      let next: PageFit;
      if (display !== 'grid') {
        next = {
          columns: 1,
          pageSize: Math.max(1, Math.floor((room + ROW_GAP) / (ROW_HEIGHT + ROW_GAP))),
          thumbHeight: null,
        };
      } else {
        const maxColumns = Math.min(
          MAX_COLUMNS,
          Math.max(1, Math.floor((width + CARD_GAP) / (MIN_CARD_WIDTH + CARD_GAP))),
        );
        let best: (PageFit & { left: number }) | null = null;
        for (let columns = Math.min(2, maxColumns); columns <= maxColumns; columns++) {
          const cardWidth = (width - CARD_GAP * (columns - 1)) / columns;
          const rows = Math.max(
            1,
            Math.floor((room + CARD_GAP) / (cardWidth * MIN_THUMB_RATIO + CARD_BODY + CARD_GAP)),
          );
          const thumbHeight = Math.floor(
            Math.min(cardWidth * MAX_THUMB_RATIO, (room - CARD_GAP * (rows - 1)) / rows - CARD_BODY),
          );
          const left = room - rows * (thumbHeight + CARD_BODY) - CARD_GAP * (rows - 1);
          const fit = { columns, pageSize: columns * rows, thumbHeight, left };
          const snug = left <= room * SNUG;
          const bestSnug = best !== null && best.left <= room * SNUG;
          if (
            !best ||
            (snug && (!bestSnug || fit.pageSize > best.pageSize)) ||
            (!snug && !bestSnug && left < best.left)
          )
            best = fit;
        }
        next = { columns: best?.columns ?? 1, pageSize: best?.pageSize ?? 1, thumbHeight: best?.thumbHeight ?? null };
      }
      const last = lastFit.current;
      if (next.columns === last.columns && next.pageSize === last.pageSize && next.thumbHeight === last.thumbHeight)
        return;
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
