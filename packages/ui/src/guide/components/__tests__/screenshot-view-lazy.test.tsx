// @vitest-environment jsdom

import type { Screenshot } from '@mimik/core/guides/types';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const renderScreenshot = vi.fn(async () => new Blob(['png'], { type: 'image/png' }));

vi.mock('@mimik/core/screenshot/render', () => ({
  renderScreenshot: () => renderScreenshot(),
  imageDimensions: vi.fn(),
}));

let next = 0;
URL.createObjectURL = () => `blob:lazy-${++next}`;
URL.revokeObjectURL = () => {};

const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];

class FakeIntersectionObserver {
  constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
    observers.push(callback);
  }
  observe() {}
  disconnect() {}
}

vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);

import { ScreenshotView } from '../ScreenshotView';

const shot: Screenshot = {
  id: 'shot-lazy',
  stepId: 'step-lazy',
  blob: new Blob(['raw']),
  mimeType: 'image/png',
  width: 1600,
  height: 900,
};

const comeIntoView = () =>
  act(() => {
    for (const notify of observers.splice(0)) notify([{ isIntersecting: true }]);
  });

beforeEach(() => {
  observers.length = 0;
  renderScreenshot.mockClear();
});

describe('ScreenshotView far from the viewport', () => {
  it('waits to draw the screenshot until its card comes near the viewport', async () => {
    const view = render(<ScreenshotView screenshot={shot} readOnly />);
    await act(async () => {});
    expect(renderScreenshot).not.toHaveBeenCalled();
    expect(view.container.querySelector('img')).toBeNull();

    comeIntoView();

    await waitFor(() => expect(view.container.querySelector('img')).not.toBeNull());
    expect(renderScreenshot).toHaveBeenCalledTimes(1);
  });

  it('redraws a cached thumbnail whose screenshot changed, even though it mounted with an image', async () => {
    const cached = { ...shot, id: 'shot-cached' };
    const first = render(<ScreenshotView screenshot={cached} cache readOnly />);
    comeIntoView();
    await waitFor(() => expect(first.container.querySelector('img')).not.toBeNull());
    first.unmount();

    const second = render(<ScreenshotView screenshot={cached} cache readOnly />);
    expect(second.container.querySelector('img')?.getAttribute('src')).toBe(`blob:lazy-${next}`);
    renderScreenshot.mockClear();

    const edited = {
      ...cached,
      edits: {
        annotations: [],
        target: { x: 1, y: 2, width: 30, height: 40, border: 'dashed' as const, color: '#4F46E5' },
      },
    };
    second.rerender(<ScreenshotView screenshot={edited} cache readOnly />);

    await waitFor(() => expect(renderScreenshot).toHaveBeenCalledTimes(1));
  });
});
