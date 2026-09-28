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
  it('fills a page with as many columns and rows as fit above the pager', () => {
    const grid = renderHook(() => usePageFit(libraryIn(1600, 1000), 'grid'));
    expect(grid.result.current).toEqual({ columns: 5, pageSize: 10 });

    const list = renderHook(() => usePageFit(libraryIn(1100, 1000), 'list'));
    expect(list.result.current).toEqual({ columns: 1, pageSize: 7 });

    const small = renderHook(() => usePageFit(libraryIn(952, 800), 'grid'));
    expect(small.result.current).toEqual({ columns: 3, pageSize: 6 });
  });
});
