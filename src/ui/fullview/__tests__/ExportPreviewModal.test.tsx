// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EXPORT_OPTIONS } from '@/core/export/options';
import type { Guide, Screenshot, Step } from '@/core/guides/types';

const exportGuideAsVideo = vi.hoisted(() => vi.fn());
const exportGuideAsHTML = vi.hoisted(() => vi.fn());
const canExportVideo = vi.hoisted(() => vi.fn());
const stored = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const downloadBlob = vi.hoisted(() => vi.fn());

vi.mock('@/core/export/download', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/export/download')>()),
  downloadBlob,
}));

vi.mock('@/core/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/env')>()),
  localStorage: { get: async () => stored.value, set: async () => {} },
}));

vi.mock('@/core/export/video-export', () => ({ exportGuideAsVideo }));
vi.mock('@mimik/ui/export/components/VideoStepPlayer', () => ({
  VideoStepPlayer: () => <div data-testid="video-player" />,
}));
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

import { ExportPreviewModal } from '@mimik/ui';

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
  const silent = () => screen.queryByRole('button', { name: 'exportPreview.audioSilent' });
  const narrated = () => screen.queryByRole('button', { name: /exportPreview\.audioNarrated/ });

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
    expect(narrated()).not.toBeNull();
  });

  it('is offered on the video tab', async () => {
    renderModal(3);

    fireEvent.click(await screen.findByRole('button', { name: 'exportPreview.modeVideo' }));

    await waitFor(() => expect(narrated()).not.toBeNull());
  });

  it('is absent entirely when this browser cannot encode video', async () => {
    canExportVideo.mockResolvedValue(false);
    renderModal(3);

    await waitFor(() => expect(exportGuideAsHTML).toHaveBeenCalled());
    expect(narrated()).toBeNull();
  });

  it('starts silent and marks the chosen side', async () => {
    renderModal(3);

    await waitFor(() => expect(silent()).not.toBeNull());
    expect(silent()?.getAttribute('aria-pressed')).toBe('true');
    expect(narrated()?.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(narrated() as HTMLElement);

    await waitFor(() => expect(narrated()?.getAttribute('aria-pressed')).toBe('true'));
    expect(silent()?.getAttribute('aria-pressed')).toBe('false');
  });

  it('is off again as soon as the panel is reopened, before any saved options load', async () => {
    const { steps, screenshots } = makeGuideOf(3);
    const props = { onOpenChange: () => {}, guide, steps, screenshots };
    const { rerender } = render(<ExportPreviewModal open {...props} />);
    await waitFor(() => expect(narrated()).not.toBeNull());
    fireEvent.click(narrated() as HTMLElement);
    await waitFor(() => expect(narrated()?.getAttribute('aria-pressed')).toBe('true'));

    rerender(<ExportPreviewModal open={false} {...props} />);
    rerender(<ExportPreviewModal open {...props} />);

    expect(narrated()?.getAttribute('aria-pressed')).toBe('false');
  });

  it('cannot be narrated without a key', async () => {
    stored.value = {};
    renderModal(3);

    await waitFor(() => expect(narrated()).not.toBeNull());
    expect((narrated() as HTMLButtonElement).disabled).toBe(true);
    expect((silent() as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('ExportPreviewModal video progress', () => {
  const narrated = () => screen.queryByRole('button', { name: /exportPreview\.audioNarrated/ });
  const hooks = () =>
    exportGuideAsVideo.mock.calls.at(-1)?.[4] as {
      onProgress: (a: number, b: number) => void;
      onVoiceProgress: (a: number, b: number) => void;
      onMuxProgress: (a: number, b: number) => void;
    };
  const percent = () => `${screen.getByRole('progressbar').getAttribute('aria-valuenow')}%`;
  const label = () => screen.getByText(/^exportPreview\.(narrating|preparingVoiceover|encodingVideo)/).textContent;

  beforeEach(() => {
    vi.clearAllMocks();
    stored.value = { voiceoverProvider: 'openai', voiceoverApiKeys: { openai: 'sk-test' } };
    canExportVideo.mockResolvedValue(true);
    exportGuideAsHTML.mockResolvedValue('<html lang="en"><head></head><body></body></html>');
    URL.createObjectURL = vi.fn(() => 'blob:video');
    URL.revokeObjectURL = vi.fn();
    exportGuideAsVideo.mockImplementation(() => new Promise(() => {}));
  });

  async function openNarratedVideo() {
    renderModal(3);
    await waitFor(() => expect(narrated()).not.toBeNull());
    fireEvent.click(narrated() as HTMLElement);
    fireEvent.click(await screen.findByRole('button', { name: 'exportPreview.modeVideo' }));
    await waitFor(() => expect(exportGuideAsVideo).toHaveBeenCalled());
    await waitFor(() => expect(exportGuideAsVideo.mock.calls.at(-1)?.[3].voiceover).toBe(true));
  }

  it('starts on the voice-over rather than encoding before the first clip is asked for', async () => {
    await openNarratedVideo();

    expect(label()).toBe('exportPreview.preparingVoiceover');

    act(() => hooks().onVoiceProgress(3, 3));
    expect(label()).toContain('exportPreview.narrating');
  });

  it('moves the bar while clips are synthesised instead of sitting at zero', async () => {
    await openNarratedVideo();

    act(() => hooks().onVoiceProgress(0, 3));
    expect(label()).toContain('exportPreview.narrating');
    expect(percent()).toBe('0%');

    act(() => hooks().onVoiceProgress(2, 3));
    expect(percent()).toBe('20%');
  });

  it('stops saying it is narrating once frames start, however narration ended', async () => {
    await openNarratedVideo();

    act(() => hooks().onVoiceProgress(1, 3));
    expect(label()).toContain('exportPreview.narrating');

    act(() => hooks().onProgress(1, 300));
    expect(label()).toBe('exportPreview.encodingVideo');
  });

  it('leaves the whole bar to encoding when narration produced no clips', async () => {
    await openNarratedVideo();

    act(() => hooks().onProgress(0, 300));
    expect(percent()).toBe('0%');

    act(() => hooks().onProgress(150, 300));
    expect(percent()).toBe('50%');
  });

  it('leaves the whole bar to encoding when narration gave up partway', async () => {
    await openNarratedVideo();

    act(() => hooks().onVoiceProgress(2, 3));
    act(() => hooks().onProgress(0, 300));

    expect(percent()).toBe('0%');
  });

  it('reserves the head only once every clip landed', async () => {
    await openNarratedVideo();

    act(() => hooks().onVoiceProgress(3, 3));
    act(() => hooks().onProgress(0, 300));

    expect(percent()).toBe('30%');
  });

  it('holds back a tail for the audio track instead of claiming to be finished', async () => {
    await openNarratedVideo();

    act(() => hooks().onVoiceProgress(3, 3));
    act(() => hooks().onProgress(300, 300));

    expect(percent()).toBe('90%');
  });

  it('fills that tail as the audio track is written', async () => {
    await openNarratedVideo();

    act(() => hooks().onVoiceProgress(3, 3));
    act(() => hooks().onProgress(300, 300));
    act(() => hooks().onMuxProgress(20, 40));

    expect(percent()).toBe('95%');

    act(() => hooks().onMuxProgress(40, 40));
    expect(percent()).toBe('100%');
  });

  it('leaves the preview label alone while a download runs beside it', async () => {
    await openNarratedVideo();
    act(() => hooks().onVoiceProgress(1, 3));
    expect(label()).toContain('exportPreview.narrating');
    const preview = hooks();

    fireEvent.click(screen.getByRole('button', { name: 'exportPreview.download[exportMenu.video]' }));
    await waitFor(() => expect(exportGuideAsVideo).toHaveBeenCalledTimes(2));
    act(() => hooks().onVoiceProgress(3, 3));
    act(() => hooks().onProgress(1, 300));

    expect(label()).toContain('exportPreview.narrating');
    expect(hooks()).not.toBe(preview);
  });

  it('keeps showing why the preview is silent after a download narrates fine', async () => {
    exportGuideAsVideo.mockResolvedValueOnce({
      blob: new Blob(['video']),
      extension: 'mp4',
      chapters: [],
      voiceoverError: { reason: 'failed', detail: 'rejected' },
    });
    await openNarratedVideo();
    await screen.findByText('exportPreview.voiceoverFailed');

    exportGuideAsVideo.mockResolvedValueOnce({ blob: new Blob(['video']), extension: 'mp4', chapters: [] });
    fireEvent.click(screen.getByRole('button', { name: 'exportPreview.download[exportMenu.video]' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());

    expect(screen.getByText('exportPreview.voiceoverFailed')).not.toBeNull();
  });

  it('saves nothing when the download is cancelled', async () => {
    renderModal(3);
    await screen.findByRole('button', { name: 'exportPreview.download[exportMenu.video]' });
    let finish!: (value: unknown) => void;
    exportGuideAsVideo.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));

    fireEvent.click(screen.getByRole('button', { name: 'exportPreview.download[exportMenu.video]' }));
    const cancel = await screen.findByRole('button', { name: /exportMenu\.cancelProgress/ });
    fireEvent.click(cancel);
    await act(async () => finish({ blob: new Blob(['video']), extension: 'mp4', chapters: [] }));

    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('still reaches the end on a silent export, which writes no audio track', async () => {
    renderModal(3);
    fireEvent.click(await screen.findByRole('button', { name: 'exportPreview.modeVideo' }));
    await waitFor(() => expect(exportGuideAsVideo).toHaveBeenCalled());

    act(() => hooks().onProgress(300, 300));

    expect(percent()).toBe('100%');
  });
});
