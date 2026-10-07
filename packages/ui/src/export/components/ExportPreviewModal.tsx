import { i18n } from '@mimik/core/env';
import {
  DEFAULT_EXPORT_OPTIONS,
  type ExportOptions,
  GIF_QUALITIES,
  type ImageScale,
  loadExportOptions,
  saveExportOptions,
  VIDEO_RESOLUTIONS,
} from '@mimik/core/export/options';
import { paginatePreview } from '@mimik/core/export/preview';
import { STEP_SECONDS } from '@mimik/core/export/video-support';
import type { Guide, Screenshot, Step } from '@mimik/core/guides/types';
import { FileCode, FileDown, FileImage, FileText, Loader2, Video } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';

import { type ExportFormat, useGuideExport } from '../hooks/use-guide-export';
import { useVideoPreview } from '../hooks/use-video-preview';

const VideoStepPlayer = lazy(() => import('./VideoStepPlayer').then((m) => ({ default: m.VideoStepPlayer })));

const _VIDEO_AUTOPLAY_STEP_LIMIT = 25;
const IMAGE_SCALES: ImageScale[] = ['small', 'medium', 'large'];

interface ExportPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guide: Guide;
  steps: Step[];
  screenshots: Map<string, Screenshot>;
}

type PreviewMode = 'document' | 'video';

export function ExportPreviewModal({ open, onOpenChange, guide, steps, screenshots }: ExportPreviewModalProps) {
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [mode, setMode] = useState<PreviewMode>('document');

  useEffect(() => {
    if (open) loadExportOptions().then(setOptions);
  }, [open]);

  const doc = useGuideExport({ active: open && mode === 'document', guide, steps, screenshots, options });
  const video = useVideoPreview({ active: open && mode === 'video', guide, steps, screenshots, options });

  const update = (patch: Partial<ExportOptions>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    void saveExportOptions(next);
  };

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
    ...(video.supported ? [{ key: 'video' as const, icon: Video, label: i18n.t('exportMenu.video') }] : []),
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

            {video.supported && (
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
                const cancellable = doc.running === key && (key === 'video' || key === 'gif');
                return (
                  <Button
                    key={key}
                    size="sm"
                    variant="ghost"
                    disabled={doc.running !== null && !cancellable}
                    onClick={() => (cancellable ? doc.cancel() : doc.run(key))}
                    className="w-full justify-start gap-2 border border-border hover:border-accent"
                  >
                    {doc.running === key ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
                    {cancellable
                      ? i18n.t('exportMenu.cancelProgress', [String(Math.round(doc.progress * 100))])
                      : i18n.t('exportPreview.download', [label])}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {video.supported && (
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
                  {doc.rendering && (
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 text-[10px] text-muted-foreground bg-card border border-border rounded-full px-2.5 py-1">
                      <Loader2 size={11} className="animate-spin" />
                      {i18n.t('exportPreview.rendering')}
                    </div>
                  )}
                  <iframe
                    title={i18n.t('exportPreview.title')}
                    srcDoc={doc.html}
                    onLoad={(event) => {
                      const doc = event.currentTarget.contentDocument;
                      if (doc) paginatePreview(doc);
                    }}
                    className="w-full h-full border-0"
                  />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  {video.deferred ? (
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
                      <Button size="sm" className="mt-1" onClick={video.request}>
                        {i18n.t('exportPreview.videoGenerate')}
                      </Button>
                    </div>
                  ) : video.error ? (
                    <div className="max-w-[320px] rounded-xl border border-border bg-card px-4 py-3 text-center">
                      <div className="text-[12px] font-semibold text-foreground">
                        {i18n.t('exportPreview.videoFailed')}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground leading-snug">{video.error}</div>
                    </div>
                  ) : video.url ? (
                    <Suspense fallback={null}>
                      <VideoStepPlayer key={video.url} src={video.url} type={video.mime} chapters={video.chapters} />
                    </Suspense>
                  ) : (
                    <div className="flex flex-col items-center gap-2 bg-card border border-border rounded-xl px-4 py-3">
                      <div className="text-[11px] text-muted-foreground">{i18n.t('exportPreview.encodingVideo')}</div>
                      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-accent transition-[width] duration-150"
                          style={{ width: `${Math.round(video.progress * 100)}%` }}
                        />
                      </div>
                      <div className="text-[10px] font-semibold tabular-nums text-foreground">
                        {Math.round(video.progress * 100)}%
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
