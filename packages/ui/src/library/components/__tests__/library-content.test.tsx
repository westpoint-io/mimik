// @vitest-environment jsdom

import type { Guide } from '@mimik/core/guides/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const guide = { id: 'g1', title: 'Export a budget to PDF', stepIds: ['s1'], starred: false, updatedAt: 1 } as Guide;

vi.mock('@mimik/core/guides/service', () => ({
  getGuides: async () => [guide],
  getStarredGuides: async () => [],
  getTrashedGuides: async () => [],
  getFirstScreenshot: async () => null,
  getStepsForGuide: async () => [],
  onGuidesChanged: () => () => {},
  permanentlyDeleteGuide: vi.fn(),
  restoreGuide: vi.fn(),
  softDeleteGuide: vi.fn(),
  toggleStar: vi.fn(),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { LibraryContent } from '../LibraryContent';

describe('LibraryContent', () => {
  it('shows the guides every time it mounts, not only the first', async () => {
    const first = render(<LibraryContent category="all" />);
    expect(await screen.findByText('Export a budget to PDF')).toBeTruthy();
    first.unmount();

    render(<LibraryContent category="all" />);
    expect(await screen.findByText('Export a budget to PDF')).toBeTruthy();
  });
});
