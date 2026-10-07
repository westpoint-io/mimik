import { downloadBlob, downloadText, safeFilename } from '@mimik/core/export/download';
import { exportGuideAsHTML } from '@mimik/core/export/html-export';
import type { ExportOptions } from '@mimik/core/export/options';
import { exportGuideAsPDF } from '@mimik/core/export/pdf-export';
import { withPreviewStyles } from '@mimik/core/export/preview';
import type { Guide, Screenshot, Step } from '@mimik/core/guides/types';
import { useEffect, useRef, useState } from 'react';

export type ExportFormat = 'docx' | 'gif' | 'html' | 'markdown' | 'pdf' | 'video';

export interface GuideExport {
  html: string;
  rendering: boolean;
  running: ExportFormat | null;
  progress: number;
  run: (format: ExportFormat) => Promise<void>;
  cancel: () => void;
}

interface Params {
  active: boolean;
  guide: Guide;
  steps: Step[];
  screenshots: Map<string, Screenshot>;
  options: ExportOptions;
}

export function useGuideExport({ active, guide, steps, screenshots, options }: Params): GuideExport {
  const [html, setHtml] = useState('');
  const [rendering, setRendering] = useState(false);
  const [running, setRunning] = useState<ExportFormat | null>(null);
  const [progress, setProgress] = useState(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setRendering(true);
    const timer = setTimeout(async () => {
      const built = await exportGuideAsHTML(guide, steps, screenshots, options);
      if (cancelled) return;
      setHtml(withPreviewStyles(built));
      setRendering(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, guide, steps, screenshots, options]);

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
      } else {
        const controller = new AbortController();
        abort.current = controller;
        setProgress(0);
        const encode =
          format === 'gif'
            ? (await import('@mimik/core/export/gif-export')).exportGuideAsGif
            : (await import('@mimik/core/export/video-export')).exportGuideAsVideo;
        const built = await encode(guide, steps, screenshots, options, {
          signal: controller.signal,
          onProgress: (encoded, frames) => setProgress(frames > 0 ? encoded / frames : 0),
        });
        downloadBlob(built.blob, safeFilename(guide.title, built.extension));
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
    } finally {
      abort.current = null;
      setRunning(null);
    }
  };

  return { html, rendering, running, progress, run, cancel: () => abort.current?.abort() };
}
