// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const duplicateGuide = vi.fn();
const navigate = vi.fn();

vi.mock('@mimik/core/guides/service', () => ({
  createSnapshot: vi.fn().mockResolvedValue(null),
  duplicateGuide: (...args: unknown[]) => duplicateGuide(...args),
}));

vi.mock('../../lib/navigate', () => ({
  navigate: (...args: unknown[]) => navigate(...args),
}));

vi.mock('../../../export/components/ExportPreviewModal', () => ({ ExportPreviewModal: () => null }));

vi.mock('../../../library/components/LibraryTools', () => ({ LibraryTools: () => null }));

const storeState = {
  counts: { all: 1, starred: 0, trash: 0 },
  guideTitle: 'LONG ORIGINAL',
  guideStepCount: 12,
  guideExportData: { guideId: 'g1', guide: {}, steps: [], screenshots: new Map() },
  setSearchOpen: vi.fn(),
  editing: false,
  setEditing: vi.fn(),
  historyOpen: false,
  setHistoryOpen: vi.fn(),
  bumpHistoryRefresh: vi.fn(),
  transcriptOpen: false,
  setTranscriptOpen: vi.fn(),
  hasTranscript: false,
};

vi.mock('../../../stores/use-fullview', () => ({
  useFullview: (selector: (s: typeof storeState) => unknown) => selector(storeState),
}));

import { TopBar } from '../TopBar';

const route = { page: 'guide', guideId: 'g1' } as const;

function duplicateButton(): HTMLButtonElement {
  const btn = screen.getAllByRole('button').find((b) => /duplicat|duplicar|副本|dupliz/i.test(b.textContent ?? ''));
  if (!btn) throw new Error('Duplicate button not rendered');
  return btn as HTMLButtonElement;
}

async function settleMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  duplicateGuide.mockReset().mockResolvedValue('copy-1');
  navigate.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('TopBar duplicate', () => {
  it('navigates into the copy it just made', async () => {
    render(<TopBar route={route} />);

    fireEvent.click(duplicateButton());
    await settleMicrotasks();

    expect(duplicateGuide).toHaveBeenCalledWith('g1');
    expect(navigate).toHaveBeenCalledWith({ page: 'guide', guideId: 'copy-1' });
  });

  it('makes one copy from a fast multi-click, not a chain of copies of copies', async () => {
    render(<TopBar route={route} />);

    fireEvent.click(duplicateButton());
    await settleMicrotasks();
    fireEvent.click(duplicateButton());
    fireEvent.click(duplicateButton());
    await settleMicrotasks();

    expect(duplicateGuide).toHaveBeenCalledTimes(1);
  });

  it('keeps the button disabled across the navigation, then releases it', async () => {
    render(<TopBar route={route} />);

    fireEvent.click(duplicateButton());
    await settleMicrotasks();
    expect(duplicateButton().disabled).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    expect(duplicateButton().disabled).toBe(false);

    fireEvent.click(duplicateButton());
    await settleMicrotasks();
    expect(duplicateGuide).toHaveBeenCalledTimes(2);
  });

  it('re-enables immediately when the copy could not be made, and says so', async () => {
    duplicateGuide.mockRejectedValue(new Error('boom'));
    render(<TopBar route={route} />);

    fireEvent.click(duplicateButton());
    await settleMicrotasks();

    expect(navigate).not.toHaveBeenCalled();
    expect(duplicateButton().disabled).toBe(false);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('reports a guide that was not there, which resolves null rather than throwing', async () => {
    duplicateGuide.mockResolvedValue(null);
    render(<TopBar route={route} />);

    fireEvent.click(duplicateButton());
    await settleMicrotasks();

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('does not carry the message onto another guide, since the nav never unmounts', async () => {
    duplicateGuide.mockRejectedValue(new Error('boom'));
    const { rerender } = render(<TopBar route={route} />);

    fireEvent.click(duplicateButton());
    await settleMicrotasks();
    expect(screen.getByRole('alert')).toBeTruthy();

    rerender(<TopBar route={{ page: 'guide', guideId: 'g2' } as const} />);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not bring the message back when you return to the guide that failed', async () => {
    duplicateGuide.mockRejectedValue(new Error('boom'));
    const { rerender } = render(<TopBar route={route} />);

    fireEvent.click(duplicateButton());
    await settleMicrotasks();
    expect(screen.getByRole('alert')).toBeTruthy();

    rerender(<TopBar route={{ page: 'library', category: 'all' } as const} />);
    rerender(<TopBar route={route} />);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('clears the message when a later attempt succeeds', async () => {
    duplicateGuide.mockRejectedValueOnce(new Error('boom'));
    render(<TopBar route={route} />);

    fireEvent.click(duplicateButton());
    await settleMicrotasks();
    expect(screen.getByRole('alert')).toBeTruthy();

    duplicateGuide.mockResolvedValue('copy-1');
    fireEvent.click(duplicateButton());
    await settleMicrotasks();

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
