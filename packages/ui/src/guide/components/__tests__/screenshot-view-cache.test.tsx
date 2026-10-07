// @vitest-environment jsdom

import type { Screenshot } from '@mimik/core/guides/types';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const renderScreenshot = vi.fn(async () => new Blob(['png'], { type: 'image/png' }));

vi.mock('@mimik/core/screenshot/render', () => ({
  renderScreenshot: () => renderScreenshot(),
  imageDimensions: vi.fn(),
}));

let next = 0;
URL.createObjectURL = () => `blob:shot-${++next}`;
URL.revokeObjectURL = () => {};

import { ScreenshotView } from '../ScreenshotView';

const shot: Screenshot = {
  id: 'shot-1',
  stepId: 'step-1',
  blob: new Blob(['raw']),
  mimeType: 'image/png',
  width: 1600,
  height: 900,
};

describe('ScreenshotView cache', () => {
  it('draws a cached thumbnail once and shows it on the first render of the next mount', async () => {
    const first = render(<ScreenshotView screenshot={shot} cache readOnly />);
    await waitFor(() => expect(first.container.querySelector('img')).not.toBeNull());
    first.unmount();

    const second = render(<ScreenshotView screenshot={{ ...shot, blob: new Blob(['raw']) }} cache readOnly />);
    expect(second.container.querySelector('img')?.getAttribute('src')).toBe('blob:shot-1');
    expect(renderScreenshot).toHaveBeenCalledTimes(1);
  });
});
