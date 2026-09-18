import { FileCode, FileDown, FileImage, FileText, Loader2, Video } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { i18n } from '#imports';
import { downloadBlob, downloadText, safeFilename } from '@/core/export/download';
import { exportGuideAsHTML } from '@/core/export/html-export';
import {
  DEFAULT_EXPORT_OPTIONS,
  type ExportOptions,
  GIF_QUALITIES,
  type ImageScale,
  loadExportOptions,
  saveExportOptions,
  VIDEO_RESOLUTIONS,
} from '@/core/export/options';
import { exportGuideAsPDF } from '@/core/export/pdf-export';
import { paginatePreview, withPreviewStyles } from '@/core/export/preview';
import type { VideoChapter } from '@/core/export/video-export';
import { COVER_SECONDS, canExportVideo, STEP_SECONDS, videoSeconds } from '@/core/export/video-support';
import { hasVoiceoverKey, VOICEOVER_SETTINGS } from '@/core/export/voiceover/config';
import { voiceoverScript } from '@/core/export/voiceover/script';
import { isBlock } from '@/core/guides/blocks';
import type { Guide, Screenshot, Step } from '@/core/guides/types';
import { localStorage } from '@/lib/browser-api';
import { Button } from '@/ui/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog';

const VideoStepPlayer = lazy(() => import('@/ui/fullview/VideoStepPlayer'));

const VIDEO_AUTOPLAY_STEP_LIMIT = 25;

function clock(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
const IMAGE_SCALES: ImageScale[] = ['small', 'medium', 'large'];

interface ExportPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guide: Guide;
  steps: Step[];
  screenshots: Map<string, Screenshot>;
}

type ExportFormat = 'docx' | 'gif' | 'html' | 'markdown' | 'pdf' | 'video';
type PreviewMode = 'document' | 'video';

export default function ExportPreviewModal({ open, onOpenChange, guide, steps, screenshots }: ExportPreviewModalProps) {
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [preview, setPreview] = useState('');
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [videoSupported, setVideoSupported] = useState(false);
  const [mode, setMode] = useState<PreviewMode>('document');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoChapters, setVideoChapters] = useState<VideoChapter[]>([]);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const downloadAbort = useRef<AbortController | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoRequested, setVideoRequested] = useState(false);
  const [voiceoverReady, setVoiceoverReady] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState<{ done: number; total: number } | null>(null);
  const [narratedSeconds, setNarratedSeconds] = useState<number | null>(null);
  const [voiceoverError, setVoiceoverError] = useState<string | null>(null);

  useEffect(() => {
    if (open) loadExportOptions().then(setOptions);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    localStorage.get([...VOICEOVER_SETTINGS]).then((stored) => {
      if (active) setVoiceoverReady(hasVoiceoverKey(stored));
    });
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    let active = true;
    canExportVideo().then((supported) => {
      if (active) setVideoSupported(supported);
    });
    return () => {
      active = false;
    };
  }, []);

  const videoPending = steps.length > VIDEO_AUTOPLAY_STEP_LIMIT && !videoRequested;
  const { cover, stepDescriptions, resolution } = options;
  const voiceover = options.voiceover && voiceoverReady;
  const frames = steps.filter((step) => isBlock(step) || screenshots.has(step.id));
  const baseSeconds = videoSeconds(frames.length, cover);
  const narration = voiceoverScript(guide, frames, cover);
  const narratedChars = narration.reduce((total, segment) => total + segment.text.length, 0);

  useEffect(() => {
    if (!open) setVideoRequested(false);
  }, [open]);

  useEffect(() => {
    if (!open || mode !== 'document') return;
    let cancelled = false;
    setRendering(true);
    const timer = setTimeout(async () => {
      const html = await exportGuideAsHTML(guide, steps, screenshots, options);
      if (cancelled) return;
      setPreview(withPreviewStyles(html));
      setRendering(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, mode, guide, steps, screenshots, options]);

  useEffect(() => {
    if (!open || mode !== 'video' || videoPending) return;
    const controller = new AbortController();
    let url: string | null = null;
    setVideoError(null);
    setVideoProgress(0);
    setVoiceProgress(null);
    setNarratedSeconds(null);
    setVoiceoverError(null);
    const timer = setTimeout(async () => {
      try {
        const { exportGuideAsVideo } = await import('@/core/export/video-export');
        const {
          blob,
          chapters,
          voiceoverError: failed,
        } = await exportGuideAsVideo(
          guide,
          steps,
          screenshots,
          { cover, stepDescriptions, resolution, voiceover },
          {
            signal: controller.signal,
            onProgress: (encoded, frames) => {
              if (!controller.signal.aborted) setVideoProgress(frames > 0 ? encoded / frames : 0);
            },
            onVoiceProgress: (done, total) => {
              if (!controller.signal.aborted) setVoiceProgress(done < total ? { done, total } : null);
            },
          },
        );
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setVideoChapters(chapters);
        setVoiceoverError(failed ?? null);
        setNarratedSeconds(
          voiceover && !failed && chapters.length > 0
            ? chapters[chapters.length - 1].end + (cover ? COVER_SECONDS : 0)
            : null,
        );
        setVideoUrl(url);
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
        setVideoError(error instanceof Error ? error.message : String(error));
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
      setVideoUrl(null);
    };
  }, [open, mode, guide, steps, screenshots, cover, stepDescriptions, resolution, voiceover, videoPending]);

  const update = (patch: Partial<ExportOptions>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    void saveExportOptions(next);
  };

  async function handleExport(format: ExportFormat) {
    setExporting(format);
    try {
      if (format === 'html') {
        const html = await exportGuideAsHTML(guide, steps, screenshots, options);
        downloadText(html, safeFilename(guide.title, 'html'), 'text/html');
      } else if (format === 'pdf') {
        downloadBlob(await exportGuideAsPDF(guide, steps, screenshots, options), safeFilename(guide.title, 'pdf'));
      } else if (format === 'docx') {
        const { exportGuideAsDOCX } = await import('@/core/export/docx-export');
        downloadBlob(await exportGuideAsDOCX(guide, steps, screenshots, options), safeFilename(guide.title, 'docx'));
      } else if (format === 'gif') {
        const controller = new AbortController();
        downloadAbort.current = controller;
        setDownloadProgress(0);
        const { exportGuideAsGif } = await import('@/core/export/gif-export');
        const { blob, extension } = await exportGuideAsGif(guide, steps, screenshots, options, {
          signal: controller.signal,
          onProgress: (encoded, frames) => setDownloadProgress(frames > 0 ? encoded / frames : 0),
        });
        downloadBlob(blob, safeFilename(guide.title, extension));
      } else if (format === 'video') {
        const controller = new AbortController();
        downloadAbort.current = controller;
        setDownloadProgress(0);
        const { exportGuideAsVideo } = await import('@/core/export/video-export');
        const { blob, extension } = await exportGuideAsVideo(
          guide,
          steps,
          screenshots,
          { ...options, voiceover },
          {
            signal: controller.signal,
            onProgress: (encoded, frames) => setDownloadProgress(frames > 0 ? encoded / frames : 0),
            onVoiceProgress: (done, total) => setVoiceProgress(done < total ? { done, total } : null),
          },
        );
        downloadBlob(blob, safeFilename(guide.title, extension));
      } else {
        const { exportGuideAsMarkdown } = await import('@/core/export/markdown-export');
        const md = await exportGuideAsMarkdown(guide, steps, screenshots);
        downloadText(md, safeFilename(guide.title, 'md'), 'text/markdown');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
    } finally {
      downloadAbort.current = null;
      setVoiceProgress(null);
      setExporting(null);
    }
  }

  const toggles: Array<{ key: keyof ExportOptions; label: string; hint: string }> = [
    { key: 'cover', label: i18n.t('exportPreview.cover'), hint: i18n.t('exportPreview.coverHint') },
    { key: 'screenshots', label: i18n.t('exportPreview.screenshots'), hint: i18n.t('exportPreview.screenshotsHint') },
    { key: 'stepUrls', label: i18n.t('exportPreview.stepUrls'), hint: i18n.t('exportPreview.stepUrlsHint') },
    {
      key: 'stepDescriptions',
      label: i18n.t('exportPreview.stepDescriptions'),
      hint: i18n.t('exportPreview.stepDescriptionsHint'),
    },
  ];

  const modes: Array<{ key: PreviewMode; icon: typeof FileText; label: string }> = [
    { key: 'document', icon: FileText, label: i18n.t('exportPreview.modeDocument') },
    { key: 'video', icon: Video, label: i18n.t('exportPreview.modeVideo') },
  ];

  const formats: Array<{ key: ExportFormat; icon: typeof FileText; label: string }> = [
    { key: 'pdf', icon: FileDown, label: i18n.t('exportMenu.pdf') },
    { key: 'docx', icon: FileText, label: i18n.t('exportMenu.docx') },
    { key: 'html', icon: FileCode, label: i18n.t('exportMenu.html') },
    { key: 'markdown', icon: FileText, label: i18n.t('exportMenu.markdown') },
    { key: 'gif', icon: FileImage, label: i18n.t('exportMenu.gif') },
    ...(videoSupported ? [{ key: 'video' as const, icon: Video, label: i18n.t('exportMenu.video') }] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[1180px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b border-border">
          <DialogTitle className="text-[15px] font-bold">{i18n.t('exportPreview.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex h-[74vh] min-h-[420px]">
          <div className="w-[268px] shrink-0 border-r border-border p-4 space-y-4 overflow-y-auto">
            <div className="space-y-3">
              {toggles.map(({ key, label, hint }) => (
                <div key={key} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-semibold text-foreground">{label}</div>
                    <div className="text-[10px] text-muted-foreground leading-snug">{hint}</div>
                  </div>
                  <button
                    type="button"
                    aria-label={label}
                    aria-pressed={Boolean(options[key])}
                    onClick={() => update({ [key]: !options[key] } as Partial<ExportOptions>)}
                    className={`w-9 h-5 rounded-full transition-colors relative shrink-0 mt-0.5 ${
                      options[key] ? 'bg-accent' : 'bg-border'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                        options[key] ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div className={`pt-3 border-t border-border ${options.screenshots ? '' : 'opacity-45'}`}>
              <div className="text-[12px] font-semibold text-foreground mb-2">{i18n.t('exportPreview.imageScale')}</div>
              <div className="flex gap-1.5">
                {IMAGE_SCALES.map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    disabled={!options.screenshots}
                    onClick={() => update({ imageScale: scale })}
                    className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] transition-colors disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-muted-foreground ${
                      options.imageScale === scale
                        ? 'border-accent text-accent'
                        : 'border-border text-muted-foreground hover:border-accent hover:text-foreground'
                    }`}
                  >
                    {i18n.t(`exportPreview.scale_${scale}`)}
                  </button>
                ))}
              </div>
            </div>

            {videoSupported && (
              <div className="pt-3 border-t border-border">
                <div className="text-[12px] font-semibold text-foreground mb-2">
                  {i18n.t('exportPreview.resolution')}
                </div>
                <div className="flex gap-1.5">
                  {VIDEO_RESOLUTIONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => update({ resolution: value })}
                      className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] transition-colors ${
                        options.resolution === value
                          ? 'border-accent text-accent'
                          : 'border-border text-muted-foreground hover:border-accent hover:text-foreground'
                      }`}
                    >
                      {i18n.t(`exportPreview.res_${value}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {videoSupported && (
              <div className="pt-3 border-t border-border">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-semibold text-foreground">{i18n.t('exportPreview.voiceover')}</div>
                    <div className="text-[10px] text-muted-foreground leading-snug">
                      {voiceoverReady ? i18n.t('exportPreview.voiceoverHint') : i18n.t('exportPreview.voiceoverNoKey')}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={i18n.t('exportPreview.voiceover')}
                    aria-pressed={voiceover}
                    disabled={!voiceoverReady}
                    onClick={() => update({ voiceover: !options.voiceover })}
                    className={`w-9 h-5 rounded-full transition-colors relative shrink-0 mt-0.5 disabled:opacity-45 disabled:cursor-not-allowed ${
                      voiceover ? 'bg-accent' : 'bg-border'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                        voiceover ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {voiceover && (
                  <div className="mt-2.5 space-y-1.5">
                    <div className="rounded-lg bg-secondary px-2.5 py-2 text-[11px] text-foreground" role="status">
                      {narratedSeconds === null
                        ? i18n.t('exportPreview.videoLength', [clock(baseSeconds)])
                        : i18n.t('exportPreview.videoLengthVoice', [clock(baseSeconds), clock(narratedSeconds)])}
                    </div>
                    <div className="px-0.5 text-[10px] text-muted-foreground leading-snug">
                      {i18n.t('exportPreview.voiceoverCost', [String(narration.length), String(narratedChars)])}
                    </div>
                    {voiceoverError && (
                      <div
                        className="rounded-lg px-2.5 py-2 text-[10px] leading-snug text-destructive bg-destructive/10"
                        role="alert"
                      >
                        {i18n.t('exportPreview.voiceoverFailed')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-border">
              <div className="text-[12px] font-semibold text-foreground mb-2">{i18n.t('exportPreview.gifQuality')}</div>
              <div className="flex gap-1.5">
                {GIF_QUALITIES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => update({ gifQuality: value })}
                    className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] transition-colors ${
                      options.gifQuality === value
                        ? 'border-accent text-accent'
                        : 'border-border text-muted-foreground hover:border-accent hover:text-foreground'
                    }`}
                  >
                    {i18n.t(`exportPreview.gif_${value}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-border space-y-1.5">
              {formats.map(({ key, icon: Icon, label }) => {
                const cancellable = exporting === key && (key === 'video' || key === 'gif');
                return (
                  <Button
                    key={key}
                    size="sm"
                    variant="ghost"
                    disabled={exporting !== null && !cancellable}
                    onClick={() => (cancellable ? downloadAbort.current?.abort() : handleExport(key))}
                    className="w-full justify-start gap-2 border border-border hover:border-accent"
                  >
                    {exporting === key ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
                    {cancellable
                      ? i18n.t('exportMenu.cancelProgress', [String(Math.round(downloadProgress * 100))])
                      : i18n.t('exportPreview.download', [label])}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {videoSupported && (
              <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b border-border">
                {modes.map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={mode === key}
                    onClick={() => setMode(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] transition-colors ${
                      mode === key
                        ? 'border-accent text-accent bg-secondary'
                        : 'border-border text-muted-foreground hover:border-accent hover:text-foreground'
                    }`}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 bg-[#3F3F46] relative overflow-hidden">
              {mode === 'document' ? (
                <>
                  {rendering && (
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 text-[10px] text-muted-foreground bg-card border border-border rounded-full px-2.5 py-1">
                      <Loader2 size={11} className="animate-spin" />
                      {i18n.t('exportPreview.rendering')}
                    </div>
                  )}
                  <iframe
                    title={i18n.t('exportPreview.title')}
                    srcDoc={preview}
                    onLoad={(event) => {
                      const doc = event.currentTarget.contentDocument;
                      if (doc) paginatePreview(doc);
                    }}
                    className="w-full h-full border-0"
                  />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  {videoPending ? (
                    <div className="max-w-[340px] flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-5 py-4 text-center">
                      <Video size={20} className="text-accent" />
                      <div className="text-[12px] font-semibold text-foreground">
                        {i18n.t('exportPreview.videoReady', [
                          String(steps.length),
                          String(Math.round((steps.length * STEP_SECONDS) / 60)),
                        ])}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-snug">
                        {i18n.t('exportPreview.videoReadyHint')}
                      </div>
                      <Button size="sm" className="mt-1" onClick={() => setVideoRequested(true)}>
                        {i18n.t('exportPreview.videoGenerate')}
                      </Button>
                    </div>
                  ) : videoError ? (
                    <div className="max-w-[320px] rounded-xl border border-border bg-card px-4 py-3 text-center">
                      <div className="text-[12px] font-semibold text-foreground">
                        {i18n.t('exportPreview.videoFailed')}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground leading-snug">{videoError}</div>
                    </div>
                  ) : videoUrl ? (
                    <Suspense fallback={null}>
                      <VideoStepPlayer
                        key={videoUrl}
                        src={videoUrl}
                        chapters={videoChapters}
                        narrated={voiceover && !voiceoverError}
                      />
                    </Suspense>
                  ) : (
                    <div className="flex flex-col items-center gap-2 bg-card border border-border rounded-xl px-4 py-3">
                      <div className="text-[11px] text-muted-foreground">
                        {voiceProgress
                          ? i18n.t('exportPreview.narrating', [
                              String(voiceProgress.done + 1),
                              String(voiceProgress.total),
                            ])
                          : i18n.t('exportPreview.encodingVideo')}
                      </div>
                      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-accent transition-[width] duration-150"
                          style={{ width: `${Math.round(videoProgress * 100)}%` }}
                        />
                      </div>
                      <div className="text-[10px] font-semibold tabular-nums text-foreground">
                        {Math.round(videoProgress * 100)}%
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
