// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePageFit } from '../use-page-fit';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

function libraryIn(width: number, height: number) {
  window.innerHeight = height;
  const main = document.createElement('main');
  main.style.paddingBottom = '32px';
  const node = document.createElement('div');
  main.append(node);
  Object.defineProperty(node, 'clientWidth', { value: width });
  node.getBoundingClientRect = () => ({ top: 96 }) as DOMRect;
  return { current: node };
}

describe('usePageFit', () => {
  it('fills the height above the pager by flexing the thumbnail between 2.8:1 and 16:9', () => {
    const room = 1000 - 96 - 32 - 64;
    const grid = renderHook(() => usePageFit(libraryIn(1600, 1000), 'grid')).result.current;
    const rows = grid.pageSize / grid.columns;
    const cardWidth = (1600 - 18 * (grid.columns - 1)) / grid.columns;
    const used = rows * ((grid.thumbHeight ?? 0) + 113) + 18 * (rows - 1);
    expect(grid).toEqual({ columns: 6, pageSize: 18, thumbHeight: 141 });
    expect(room - used).toBeLessThanOrEqual(room * 0.04);
    expect(grid.thumbHeight).toBeGreaterThanOrEqual(Math.floor(cardWidth * 0.36));
    expect(grid.thumbHeight).toBeLessThanOrEqual(cardWidth * (9 / 16));

    const list = renderHook(() => usePageFit(libraryIn(1100, 1000), 'list'));
    expect(list.result.current).toEqual({ columns: 1, pageSize: 7, thumbHeight: null });
  });
});
