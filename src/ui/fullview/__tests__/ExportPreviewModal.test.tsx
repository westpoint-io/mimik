// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EXPORT_OPTIONS } from '@/core/export/options';
import type { Guide, Screenshot, Step } from '@/core/guides/types';

const exportGuideAsVideo = vi.hoisted(() => vi.fn());
const exportGuideAsHTML = vi.hoisted(() => vi.fn());
const canExportVideo = vi.hoisted(() => vi.fn());
const stored = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock('@/lib/browser-api', () => ({
  localStorage: { get: async () => stored.value, set: async () => {} },
}));

vi.mock('@/core/export/video-export', () => ({ exportGuideAsVideo }));
vi.mock('@/ui/fullview/VideoStepPlayer', () => ({ default: () => <div data-testid="video-player" /> }));
vi.mock('@/core/export/html-export', () => ({ exportGuideAsHTML }));
vi.mock('@/core/export/video-support', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/export/video-support')>()),
  canExportVideo,
}));
vi.mock('@/core/export/options', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/export/options')>()),
  loadExportOptions: async () => DEFAULT_EXPORT_OPTIONS,
  saveExportOptions: async () => {},
}));

import ExportPreviewModal from '@/ui/fullview/ExportPreviewModal';

const guide: Guide = {
  id: 'guide-1',
  title: 'Test Guide',
  createdAt: 0,
  updatedAt: 0,
  stepIds: [],
  starred: false,
  deletedAt: null,
};

function makeGuideOf(stepCount: number) {
  const steps = Array.from(
    { length: stepCount },
    (_, i): Step => ({
      id: `step-${i}`,
      guideId: 'guide-1',
      index: i,
      description: `Step ${i}`,
      action: 'click',
      url: 'https://example.com',
      timestamp: 0,
    }),
  );
  const screenshots = new Map<string, Screenshot>(
    steps.map((s) => [
      s.id,
      {
        id: `shot-${s.id}`,
        stepId: s.id,
        blob: new Blob(['x']),
        mimeType: 'image/png',
        width: 1280,
        height: 800,
      },
    ]),
  );
  return { steps, screenshots };
}

function renderModal(stepCount: number) {
  const { steps, screenshots } = makeGuideOf(stepCount);
  render(<ExportPreviewModal open onOpenChange={() => {}} guide={guide} steps={steps} screenshots={screenshots} />);
  return steps;
}

const stepIdsPassedToVideo = () => (exportGuideAsVideo.mock.calls[0][1] as Step[]).map((s) => s.id);

describe('ExportPreviewModal video preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canExportVideo.mockResolvedValue(true);
    exportGuideAsHTML.mockResolvedValue('<html lang="en"><head></head><body></body></html>');
    exportGuideAsVideo.mockResolvedValue({ blob: new Blob(['video']), extension: 'mp4', chapters: [] });
    URL.createObjectURL = vi.fn(() => 'blob:video');
    URL.revokeObjectURL = vi.fn();
  });

  it('encodes every step, not a truncated sample', async () => {
    const steps = renderModal(8);

    fireEvent.click(await screen.findByRole('button', { name: 'exportPreview.modeVideo' }));

    await waitFor(() => expect(exportGuideAsVideo).toHaveBeenCalled());
    expect(stepIdsPassedToVideo()).toEqual(steps.map((s) => s.id));
  });

  it('waits for an explicit request before encoding a long guide', async () => {
    renderModal(30);

    fireEvent.click(await screen.findByRole('button', { name: 'exportPreview.modeVideo' }));

    expect(await screen.findByRole('button', { name: 'exportPreview.videoGenerate' })).toBeTruthy();
    await new Promise((r) => setTimeout(r, 400));
    expect(exportGuideAsVideo).not.toHaveBeenCalled();
  });

  it('encodes all steps of a long guide once requested', async () => {
    const steps = renderModal(30);

    fireEvent.click(await screen.findByRole('button', { name: 'exportPreview.modeVideo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'exportPreview.videoGenerate' }));

    await waitFor(() => expect(exportGuideAsVideo).toHaveBeenCalled());
    expect(stepIdsPassedToVideo()).toHaveLength(30);
    expect(stepIdsPassedToVideo()).toEqual(steps.map((s) => s.id));
  });
});

describe('ExportPreviewModal document preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canExportVideo.mockResolvedValue(false);
    exportGuideAsHTML.mockResolvedValue('<html lang="en"><head></head><body></body></html>');
  });

  it('renders every step into the document preview', async () => {
    const steps = renderModal(40);

    await waitFor(() => expect(exportGuideAsHTML).toHaveBeenCalled());
    const passed = exportGuideAsHTML.mock.calls[0][1] as Step[];
    expect(passed.map((s) => s.id)).toEqual(steps.map((s) => s.id));
  });
});

describe('ExportPreviewModal voice-over controls', () => {
  const voiceoverToggle = () => screen.queryByRole('button', { name: 'exportPreview.voiceover' });
  const lengthNote = () => screen.queryByText(/exportPreview\.videoLength/);

  beforeEach(() => {
    vi.clearAllMocks();
    stored.value = { voiceoverProvider: 'openai', voiceoverApiKeys: { openai: 'sk-test' } };
    canExportVideo.mockResolvedValue(true);
    exportGuideAsHTML.mockResolvedValue('<html lang="en"><head></head><body></body></html>');
    exportGuideAsVideo.mockResolvedValue({ blob: new Blob(['video']), extension: 'mp4', chapters: [] });
    URL.createObjectURL = vi.fn(() => 'blob:video');
    URL.revokeObjectURL = vi.fn();
  });

  it('is offered on the document tab too, since video can be exported from there', async () => {
    renderModal(3);

    await waitFor(() => expect(exportGuideAsHTML).toHaveBeenCalled());
    expect(voiceoverToggle()).not.toBeNull();
  });

  it('is offered on the video tab', async () => {
    renderModal(3);

    fireEvent.click(await screen.findByRole('button', { name: 'exportPreview.modeVideo' }));

    await waitFor(() => expect(voiceoverToggle()).not.toBeNull());
  });

  it('is absent entirely when this browser cannot encode video', async () => {
    canExportVideo.mockResolvedValue(false);
    renderModal(3);

    await waitFor(() => expect(exportGuideAsHTML).toHaveBeenCalled());
    expect(voiceoverToggle()).toBeNull();
  });

  it('holds the length estimate back until voice-over is switched on', async () => {
    renderModal(3);

    await waitFor(() => expect(voiceoverToggle()).not.toBeNull());
    expect(lengthNote()).toBeNull();

    fireEvent.click(voiceoverToggle() as HTMLElement);
    await waitFor(() => expect(lengthNote()).not.toBeNull());
  });

  it('cannot be switched on without a key', async () => {
    stored.value = {};
    renderModal(3);

    await waitFor(() => expect(voiceoverToggle()).not.toBeNull());
    expect((voiceoverToggle() as HTMLButtonElement).disabled).toBe(true);
    expect(lengthNote()).toBeNull();
  });
});
