import { downloadBlob, downloadText, safeFilename } from '@mimik/core/export/download';
import { exportGuideAsHTML } from '@mimik/core/export/html-export';
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions } from '@mimik/core/export/options';
import { exportGuideAsPDF } from '@mimik/core/export/pdf-export';
import { withPreviewStyles } from '@mimik/core/export/preview';
import type { VoiceoverSkip } from '@mimik/core/export/video-export';
import type { Guide, Screenshot, Step } from '@mimik/core/guides/types';
import { BUNDLE_EXTENSION } from '@mimik/core/transfer/schema';
import { useEffect, useMemo, useRef, useState } from 'react';
import { exportProgress, MUX_PROGRESS_SHARE, VOICE_PROGRESS_SHARE } from '../lib/export-progress';

export type ExportFormat = 'bundle' | 'docx' | 'gif' | 'html' | 'markdown' | 'pdf' | 'video';

export interface GuideExport {
  html: string;
  rendering: boolean;
  running: ExportFormat | null;
  progress: number;
  voiceoverError: VoiceoverSkip | null;
  run: (format: ExportFormat) => Promise<void>;
  cancel: () => void;
}

interface Params {
  active: boolean;
  guide: Guide;
  steps: Step[];
  screenshots: Map<string, Screenshot>;
  options: ExportOptions;
  voiceover: boolean;
}

export function useGuideExport({ active, guide, steps, screenshots, options, voiceover }: Params): GuideExport {
  const [html, setHtml] = useState('');
  const [rendering, setRendering] = useState(false);
  const [running, setRunning] = useState<ExportFormat | null>(null);
  const [progress, setProgress] = useState(0);
  const [voiceoverError, setVoiceoverError] = useState<VoiceoverSkip | null>(null);
  const abort = useRef<AbortController | null>(null);

  const { cover, screenshots: withScreenshots, stepUrls, imageScale, stepDescriptions } = options;
  const previewOptions = useMemo<ExportOptions>(
    () => ({ ...DEFAULT_EXPORT_OPTIONS, cover, screenshots: withScreenshots, stepUrls, imageScale, stepDescriptions }),
    [cover, withScreenshots, stepUrls, imageScale, stepDescriptions],
  );

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setRendering(true);
    const timer = setTimeout(async () => {
      const built = await exportGuideAsHTML(guide, steps, screenshots, previewOptions);
      if (cancelled) return;
      setHtml(withPreviewStyles(built));
      setRendering(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, guide, steps, screenshots, previewOptions]);

  const run = async (format: ExportFormat) => {
    setRunning(format);
    try {
      if (format === 'html') {
        const built = await exportGuideAsHTML(guide, steps, screenshots, options);
        downloadText(built, safeFilename(guide.title, 'html'), 'text/html');
      } else if (format === 'pdf') {
        downloadBlob(await exportGuideAsPDF(guide, steps, screenshots, options), safeFilename(guide.title, 'pdf'));
      } else if (format === 'docx') {
        const { exportGuideAsDOCX } = await import('@mimik/core/export/docx-export');
        downloadBlob(await exportGuideAsDOCX(guide, steps, screenshots, options), safeFilename(guide.title, 'docx'));
      } else if (format === 'markdown') {
        const { exportGuideAsMarkdown } = await import('@mimik/core/export/markdown-export');
        const md = await exportGuideAsMarkdown(guide, steps, screenshots);
        downloadText(md, safeFilename(guide.title, 'md'), 'text/markdown');
      } else if (format === 'bundle') {
        const { exportGuideAsBundle } = await import('@mimik/core/transfer/bundle');
        const blob = await exportGuideAsBundle(guide, steps, screenshots, {
          stripInputValues: options.bundleStripInputs,
          urls: options.bundleUrls,
        });
        downloadBlob(blob, safeFilename(guide.title, BUNDLE_EXTENSION));
      } else if (format === 'gif') {
        const controller = new AbortController();
        abort.current = controller;
        setProgress(0);
        const { exportGuideAsGif } = await import('@mimik/core/export/gif-export');
        const built = await exportGuideAsGif(guide, steps, screenshots, options, {
          signal: controller.signal,
          onProgress: (encoded, frames) => setProgress(frames > 0 ? encoded / frames : 0),
        });
        if (controller.signal.aborted) return;
        downloadBlob(built.blob, safeFilename(guide.title, built.extension));
      } else {
        const controller = new AbortController();
        abort.current = controller;
        setProgress(0);
        setVoiceoverError(null);
        const voiceShare = voiceover ? VOICE_PROGRESS_SHARE : 0;
        const muxShare = voiceover ? MUX_PROGRESS_SHARE : 0;
        let allClipsLanded = false;
        const { exportGuideAsVideo } = await import('@mimik/core/export/video-export');
        const built = await exportGuideAsVideo(
          guide,
          steps,
          screenshots,
          { ...options, voiceover },
          {
            signal: controller.signal,
            onProgress: (encoded, frames) =>
              setProgress(
                exportProgress.encode(encoded, frames, allClipsLanded ? voiceShare : 0, allClipsLanded ? muxShare : 0),
              ),
            onVoiceProgress: (done, total) => {
              allClipsLanded = done === total;
              setProgress(exportProgress.narrate(done, total, voiceShare));
            },
            onMuxProgress: (done, total) => setProgress(exportProgress.mux(done, total, muxShare)),
          },
        );
        if (controller.signal.aborted) return;
        setVoiceoverError(built.voiceoverError ?? null);
        downloadBlob(built.blob, safeFilename(guide.title, built.extension));
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
    } finally {
      abort.current = null;
      setRunning(null);
    }
  };

  return { html, rendering, running, progress, voiceoverError, run, cancel: () => abort.current?.abort() };
}
