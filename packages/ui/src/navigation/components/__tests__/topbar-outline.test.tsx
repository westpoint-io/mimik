// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFullviewStore } from '../../../stores/fullview';
import { TopBar } from '../TopBar';

vi.mock('@mimik/core/guides/service', () => ({
  createSnapshot: vi.fn().mockResolvedValue(null),
  duplicateGuide: vi.fn(),
}));

vi.mock('../../../export/components/ExportPreviewModal', () => ({ ExportPreviewModal: () => null }));

vi.mock('../../../library/components/LibraryTools', () => ({ LibraryTools: () => null }));

const route = { page: 'guide', guideId: 'g1' } as const;

beforeEach(() => {
  act(() => {
    useFullviewStore.setState({
      guideExportData: { guideId: 'g1', guide: {}, steps: [], screenshots: new Map() } as never,
      editing: false,
      outlineCollapsed: false,
      outlineDrawerOpen: false,
      historyOpen: false,
      transcriptOpen: false,
    });
  });
});

describe('TopBar outline toggle', () => {
  it('toggles the rail on a wide window and shows whether it is open', () => {
    render(<TopBar route={route} />);
    const toggle = screen.getByRole('button', { name: 'outline.title' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(toggle);

    expect(useFullviewStore.getState().outlineCollapsed).toBe(true);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles the drawer while a side panel is open', () => {
    act(() => {
      useFullviewStore.setState({ historyOpen: true });
    });
    render(<TopBar route={route} />);
    const toggle = screen.getByRole('button', { name: 'outline.title' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);

    expect(useFullviewStore.getState().outlineDrawerOpen).toBe(true);
    expect(useFullviewStore.getState().outlineCollapsed).toBe(false);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});
