import { Download, FileCode, FileDown, FileImage, FileText, Loader2, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { i18n } from '#imports';
import { downloadBlob, downloadText, safeFilename } from '@/core/export/download';
import { exportGuideAsHTML } from '@/core/export/html-export';
import { exportGuideAsMarkdown } from '@/core/export/markdown-export';
import { loadExportOptions } from '@/core/export/options';
import { exportGuideAsPDF } from '@/core/export/pdf-export';
import { canExportVideo } from '@/core/export/video-support';
import { getGuide } from '@/core/guides/service';
import type { Guide, Screenshot, Step } from '@/core/guides/types';
import { Button } from '@/ui/components/ui/button';

interface ExportMenuProps {
  guideId: string;
  guide: Guide;
  steps: Step[];
  screenshots: Map<string, Screenshot>;
}

type ExportType = 'docx' | 'gif' | 'html' | 'markdown' | 'pdf' | 'video';

export default function ExportMenu({
  guideId,
  guide: guideProp,
  steps: stepsProp,
  screenshots: screenshotsProp,
}: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [videoSupported, setVideoSupported] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    canExportVideo().then((supported) => {
      if (active) setVideoSupported(supported);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleExport(type: ExportType) {
    setOpen(false);
    setExporting(true);
    try {
      const fresh = await getGuide(guideId);
      const guide = fresh?.guide ?? guideProp;
      const steps = fresh?.steps ?? stepsProp;
      const screenshots = fresh?.screenshots ?? screenshotsProp;

      if (type === 'html') {
        const html = await exportGuideAsHTML(guide, steps, screenshots);
        downloadText(html, safeFilename(guide.title, 'html'), 'text/html');
      } else if (type === 'docx') {
        const { exportGuideAsDOCX } = await import('@/core/export/docx-export');
        downloadBlob(await exportGuideAsDOCX(guide, steps, screenshots), safeFilename(guide.title, 'docx'));
      } else if (type === 'markdown') {
        const md = await exportGuideAsMarkdown(guide, steps, screenshots);
        downloadText(md, safeFilename(guide.title, 'md'), 'text/markdown');
      } else if (type === 'gif') {
        const controller = new AbortController();
        abortRef.current = controller;
        setProgress(0);
        const { exportGuideAsGif } = await import('@/core/export/gif-export');
        const { blob, extension } = await exportGuideAsGif(guide, steps, screenshots, undefined, {
          signal: controller.signal,
          onProgress: (encoded, frames) => setProgress(frames > 0 ? encoded / frames : 0),
        });
        downloadBlob(blob, safeFilename(guide.title, extension));
      } else if (type === 'video') {
        const controller = new AbortController();
        abortRef.current = controller;
        setProgress(0);
        const { exportGuideAsVideo } = await import('@/core/export/video-export');
        const saved = await loadExportOptions();
        const { blob, extension } = await exportGuideAsVideo(
          guide,
          steps,
          screenshots,
          { ...saved, voiceover: false },
          {
            signal: controller.signal,
            onProgress: (encoded, frames) => setProgress(frames > 0 ? encoded / frames : 0),
          },
        );
        downloadBlob(blob, safeFilename(guide.title, extension));
      } else {
        downloadBlob(await exportGuideAsPDF(guide, steps, screenshots), safeFilename(guide.title, 'pdf'));
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
    } finally {
      abortRef.current = null;
      setProgress(null);
      setExporting(false);
    }
  }

  const items = [
    { type: 'docx' as const, icon: FileText, label: i18n.t('exportMenu.docx') },
    { type: 'html' as const, icon: FileCode, label: i18n.t('exportMenu.html') },
    { type: 'markdown' as const, icon: FileText, label: i18n.t('exportMenu.markdown') },
    { type: 'pdf' as const, icon: FileDown, label: i18n.t('exportMenu.pdf') },
    { type: 'gif' as const, icon: FileImage, label: i18n.t('exportMenu.gif') },
    ...(videoSupported ? [{ type: 'video' as const, icon: Video, label: i18n.t('exportMenu.video') }] : []),
  ];

  return (
    <div ref={menuRef} className="relative">
      <Button
        size="sm"
        onClick={() => (progress === null ? setOpen((prev) => !prev) : abortRef.current?.abort())}
        disabled={exporting && progress === null}
      >
        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        {progress === null
          ? i18n.t('common.export')
          : i18n.t('exportMenu.cancelProgress', [String(Math.round(progress * 100))])}
      </Button>

      {open && !exporting && (
        <div className="absolute right-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-lg py-1 z-10">
          {items.map((item) => (
            <button
              key={item.type}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-secondary"
              onClick={() => handleExport(item.type)}
            >
              <item.icon size={14} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
