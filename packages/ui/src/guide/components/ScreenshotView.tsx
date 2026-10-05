import { i18n } from '@mimik/core/env';
import { deleteScreenshot, replaceScreenshot, updateScreenshotEdits } from '@mimik/core/guides/service';
import type { Screenshot, ScreenshotBounds } from '@mimik/core/guides/types';
import { panBy, resolveViewport, zoomBy } from '@mimik/core/screenshot/geometry';
import { imageDimensions, renderScreenshot } from '@mimik/core/screenshot/render';
import type { ScreenshotEdits } from '@mimik/core/screenshot/types';
import { Download, ImageUp, Pencil, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '../../common/components/ConfirmDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { renderKey } from '../lib/render-key';
import { withFullViewport } from '../lib/with-full-viewport';
import { ImagePlaceholder } from './ImagePlaceholder';
import { ReplaceImageDialog } from './ReplaceImageDialog';

interface ScreenshotViewProps {
  screenshot: Screenshot;
  className?: string;
  alt?: string;
  animate?: boolean;
  crop?: boolean;
  frameRatio?: number;
  cover?: boolean;
  readOnly?: boolean;
  cache?: boolean;
  onOpenEditor?: (tool: 'annotate' | 'redact' | 'crop' | 'target') => void;
  onChanged?: () => void;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startViewport: ScreenshotBounds;
  moved: boolean;
}

const SAVE_DEBOUNCE_MS = 400;
const SAVED_MESSAGE_MS = 1500;
const ZOOM_IN_FACTOR = 1.25;
const ZOOM_OUT_FACTOR = 0.8;
const VIEWPORT_EPSILON = 0.5;
const FRAME_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const FRAME_TRANSITION = `width 0.4s ${FRAME_EASING}, height 0.4s ${FRAME_EASING}, left 0.4s ${FRAME_EASING}, top 0.4s ${FRAME_EASING}`;
const FRAME_RATIO_EPSILON = 0.01;
const RENDERED = new Map<string, string>();
const RENDERED_LIMIT = 48;

export function ScreenshotView({
  screenshot,
  className = '',
  alt = '',
  animate = false,
  crop = false,
  frameRatio,
  cover = false,
  readOnly = false,
  cache = false,
  onOpenEditor,
  onChanged,
}: ScreenshotViewProps) {
  const [fullUrl, setFullUrl] = useState<string | null>(() => {
    const key = cache ? renderKey(screenshot, screenshot.edits) : null;
    return key ? (RENDERED.get(key) ?? null) : null;
  });
  const [showViewport, setShowViewport] = useState(!animate && fullUrl !== null);
  const [editsOverride, setEditsOverride] = useState<ScreenshotEdits | undefined>(undefined);
  const [screenshotOverride, setScreenshotOverride] = useState<Screenshot | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [altDraft, setAltDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const processedKeyRef = useRef<string | null>(fullUrl ? renderKey(screenshot, screenshot.edits) : null);
  const urlRef = useRef<string | null>(null);
  const propScreenshotRef = useRef(screenshot);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const baseScreenshot = screenshotOverride ?? screenshot;
  const effectiveEdits = editsOverride ?? screenshot.edits;
  const effectiveScreenshot: Screenshot = { ...baseScreenshot, edits: effectiveEdits };

  useEffect(() => {
    if (propScreenshotRef.current !== screenshot) {
      propScreenshotRef.current = screenshot;
      setEditsOverride(undefined);
      setScreenshotOverride(null);
      setDeleted(false);
    }
  }, [screenshot]);

  useEffect(() => {
    setAltDraft(effectiveEdits?.alt ?? '');
  }, [effectiveEdits?.alt]);

  const annotationsForRender = effectiveEdits?.annotations;
  const targetForRender = effectiveEdits?.target;

  useEffect(() => {
    const cacheKey = renderKey(baseScreenshot, { annotations: annotationsForRender, target: targetForRender });
    if (!cacheKey || processedKeyRef.current === cacheKey) return;
    const hit = cache ? RENDERED.get(cacheKey) : undefined;
    if (hit) {
      processedKeyRef.current = cacheKey;
      setShowViewport(false);
      setFullUrl(hit);
      return;
    }

    let cancelled = false;
    const current: Screenshot = {
      ...baseScreenshot,
      edits: { annotations: annotationsForRender, target: targetForRender },
    };

    (async () => {
      const blob = await renderScreenshot(withFullViewport(current));
      const newUrl = URL.createObjectURL(blob);

      if (cancelled) {
        URL.revokeObjectURL(newUrl);
        return;
      }

      processedKeyRef.current = cacheKey;
      if (cache) {
        RENDERED.set(cacheKey, newUrl);
        const oldest = RENDERED.size > RENDERED_LIMIT ? RENDERED.entries().next().value : undefined;
        if (oldest) {
          RENDERED.delete(oldest[0]);
          URL.revokeObjectURL(oldest[1]);
        }
      } else {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = newUrl;
      }
      setShowViewport(false);
      setFullUrl(newUrl);
    })();

    return () => {
      cancelled = true;
    };
  }, [baseScreenshot, annotationsForRender, targetForRender, cache]);

  useEffect(() => {
    if (!fullUrl || showViewport) return;
    if (!animate) {
      setShowViewport(true);
      return;
    }
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => {
        setShowViewport(true);
      });
    });
    return () => cancelAnimationFrame(id);
  }, [fullUrl, showViewport, animate]);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const scheduleSave = (edits: ScreenshotEdits) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      updateScreenshotEdits(baseScreenshot.id, edits).then(() => {
        setSaved(true);
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaved(false), SAVED_MESSAGE_MS);
      });
    }, SAVE_DEBOUNCE_MS);
  };

  const handleZoom = (factor: number) => {
    const viewport = resolveViewport(effectiveScreenshot);
    const nextViewport = zoomBy(viewport, factor, baseScreenshot);
    const nextEdits: ScreenshotEdits = { ...effectiveEdits, viewport: nextViewport };
    setEditsOverride(nextEdits);
    scheduleSave(nextEdits);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || !crop) return;
    const viewport = resolveViewport(effectiveScreenshot);
    const zoomed =
      viewport.width < baseScreenshot.width - VIEWPORT_EPSILON ||
      viewport.height < baseScreenshot.height - VIEWPORT_EPSILON;
    if (!zoomed) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startViewport: viewport,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const el = e.currentTarget;
    if (el.clientWidth === 0) return;
    drag.moved = true;
    const scale = drag.startViewport.width / el.clientWidth;
    const dx = (e.clientX - drag.startX) * scale;
    const dy = (e.clientY - drag.startY) * scale;
    const nextViewport = panBy(drag.startViewport, -dx, -dy, baseScreenshot);
    setEditsOverride({ ...effectiveEdits, viewport: nextViewport });
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (drag.moved) scheduleSave(effectiveEdits ?? {});
  };

  const handleAltChange = (value: string) => {
    setAltDraft(value);
    const nextEdits: ScreenshotEdits = { ...effectiveEdits, alt: value };
    setEditsOverride(nextEdits);
    scheduleSave(nextEdits);
  };

  const handleReplaceFile = async (file: File) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setReplaceOpen(false);

    const { width, height } = await imageDimensions(file);

    const nextEdits: ScreenshotEdits = { ...effectiveEdits, target: null };
    delete nextEdits.viewport;
    delete nextEdits.alt;

    const newId = await replaceScreenshot(screenshot.stepId, file, { width, height }, nextEdits);

    setScreenshotOverride({
      ...baseScreenshot,
      id: newId,
      blob: file,
      mimeType: file.type,
      width,
      height,
    });
    setEditsOverride(nextEdits);
    setDeleted(false);
    onChanged?.();
  };

  const handleDownload = async (which: 'edited' | 'original') => {
    const blob = which === 'original' ? baseScreenshot.blob : await renderScreenshot(effectiveScreenshot);
    const ext = which === 'original' ? (baseScreenshot.mimeType.split('/')[1] ?? 'png') : 'webp';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mimik-screenshot-${screenshot.id}-${which}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteImage = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setConfirmDelete(false);
    await deleteScreenshot(screenshot.stepId);
    setDeleted(true);
    onChanged?.();
  };

  const ownRatio =
    baseScreenshot.width && baseScreenshot.height ? baseScreenshot.width / baseScreenshot.height : 16 / 9;
  const ratio = frameRatio ?? ownRatio;

  if (deleted) {
    return (
      <ImagePlaceholder
        label={i18n.t('screenshotView.imageDeleted')}
        ratio={ratio}
        className={className}
        onUpload={readOnly ? undefined : handleReplaceFile}
      />
    );
  }

  if (!fullUrl) {
    return (
      <div
        className={`rounded-lg bg-secondary p-4 flex flex-col gap-2.5 ${cover ? 'h-full' : ''} ${className}`}
        style={cover ? undefined : { aspectRatio: ratio }}
      >
        <div className="h-7 rounded-md bg-border/60 animate-pulse" />
        <div className="flex-1 flex gap-3">
          <div className="w-[30%] flex flex-col gap-2">
            <div className="h-5 rounded bg-border/50 animate-pulse [animation-delay:100ms]" />
            <div className="h-4 rounded bg-border/40 animate-pulse [animation-delay:200ms]" />
            <div className="h-4 rounded bg-border/40 animate-pulse [animation-delay:300ms]" />
            <div className="h-4 rounded bg-border/40 animate-pulse [animation-delay:400ms]" />
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-6 w-3/5 rounded bg-border/40 animate-pulse [animation-delay:150ms]" />
            <div className="h-3 w-4/5 rounded bg-border/30 animate-pulse [animation-delay:250ms]" />
            <div className="h-3 w-[70%] rounded bg-border/30 animate-pulse [animation-delay:350ms]" />
            <div className="h-3 w-3/4 rounded bg-border/30 animate-pulse [animation-delay:450ms]" />
          </div>
        </div>
      </div>
    );
  }

  const currentViewport = resolveViewport(effectiveScreenshot);
  const isZoomed =
    currentViewport.width < baseScreenshot.width - VIEWPORT_EPSILON ||
    currentViewport.height < baseScreenshot.height - VIEWPORT_EPSILON;
  const showZoomControls = !readOnly && crop;
  const showTopControls = !readOnly;
  const altText = effectiveEdits?.alt || alt;

  const fullFrame: ScreenshotBounds = { x: 0, y: 0, width: baseScreenshot.width, height: baseScreenshot.height };
  const displayedViewport = crop && showViewport ? currentViewport : fullFrame;
  const imgStyle: React.CSSProperties = {
    width: `${(baseScreenshot.width / displayedViewport.width) * 100}%`,
    height: `${(baseScreenshot.height / displayedViewport.height) * 100}%`,
    left: `${(-displayedViewport.x / displayedViewport.width) * 100}%`,
    top: `${(-displayedViewport.y / displayedViewport.height) * 100}%`,
    transition: animate ? FRAME_TRANSITION : undefined,
  };

  const vpRatio = displayedViewport.width / displayedViewport.height;
  const letterbox =
    !cover && frameRatio !== undefined && Math.abs(vpRatio - frameRatio) > FRAME_RATIO_EPSILON ? frameRatio : undefined;
  const coverFit: React.CSSProperties | undefined = cover
    ? { minWidth: '100%', minHeight: '100%', flex: 'none' }
    : undefined;
  const frameFit: React.CSSProperties | undefined =
    letterbox === undefined ? undefined : vpRatio >= letterbox ? { width: '100%' } : { height: '100%' };

  const frame = (
    <div
      data-screenshot-frame=""
      className={letterbox === undefined && !cover ? 'relative overflow-hidden w-full' : 'relative overflow-hidden'}
      style={{ aspectRatio: `${displayedViewport.width} / ${displayedViewport.height}`, ...frameFit, ...coverFit }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <img
        src={fullUrl}
        alt={altText}
        draggable={false}
        className={`absolute block max-w-none ${showZoomControls && isZoomed ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={imgStyle}
      />
    </div>
  );

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-border ${cover ? 'h-full flex items-center justify-center' : ''} ${className}`}
    >
      {letterbox === undefined ? (
        frame
      ) : (
        <div className="w-full flex items-center justify-center bg-secondary" style={{ aspectRatio: letterbox }}>
          {frame}
        </div>
      )}
      {showTopControls && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center h-7 px-2 rounded-md border border-border bg-card/90 text-foreground backdrop-blur-sm text-[10px] font-semibold tracking-wide transition-colors hover:bg-secondary hover:text-accent"
                  >
                    {i18n.t('screenshotView.altButton')}
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>{i18n.t('screenshotView.altLabel')}</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" onClick={(e) => e.stopPropagation()}>
              <p className="text-xs font-semibold text-foreground mb-2">{i18n.t('screenshotView.altLabel')}</p>
              <textarea
                value={altDraft}
                onChange={(e) => handleAltChange(e.target.value)}
                placeholder={i18n.t('screenshotView.altPlaceholder')}
                rows={3}
                className="w-full text-sm rounded-md border border-border bg-card px-2 py-1.5 text-foreground outline-none focus-visible:border-accent resize-none"
              />
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={i18n.t('screenshotView.editMenu')}
                    className="flex items-center justify-center w-7 h-7 rounded-md border border-border bg-card/90 text-foreground backdrop-blur-sm transition-colors hover:bg-secondary hover:text-accent"
                  >
                    <Pencil size={14} />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{i18n.t('screenshotView.editMenu')}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => onOpenEditor?.('annotate')}>
                <Pencil size={14} />
                {i18n.t('screenshotView.edit')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setReplaceOpen(true)}>
                <ImageUp size={14} />
                {i18n.t('screenshotView.replaceImage')}
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Download size={14} />
                  {i18n.t('screenshotView.download')}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => handleDownload('edited')}>
                    {i18n.t('screenshotView.downloadEdited')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleDownload('original')}>
                    {i18n.t('screenshotView.downloadOriginal')}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2 size={14} />
                {i18n.t('screenshotView.deleteImage')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ReplaceImageDialog open={replaceOpen} onSelect={handleReplaceFile} onCancel={() => setReplaceOpen(false)} />
          <ConfirmDialog
            open={confirmDelete}
            heading={i18n.t('screenshotView.deleteImage')}
            description={i18n.t('screenshotView.deleteConfirm')}
            destructive
            onConfirm={handleDeleteImage}
            onCancel={() => setConfirmDelete(false)}
          />
        </div>
      )}
      {!readOnly && saved && (
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center px-2.5 h-7 rounded-md text-[10px] font-semibold bg-primary text-primary-foreground shadow-sm">
          {i18n.t('screenshotView.saved')}
        </span>
      )}
      <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1">
        {showZoomControls && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleZoom(ZOOM_IN_FACTOR);
                  }}
                  aria-label={i18n.t('screenshotView.zoomIn')}
                  className="flex items-center justify-center w-7 h-7 rounded-md border border-border bg-card/90 text-foreground backdrop-blur-sm transition-colors hover:bg-secondary hover:text-accent"
                >
                  <ZoomIn size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{i18n.t('screenshotView.zoomIn')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleZoom(ZOOM_OUT_FACTOR);
                  }}
                  aria-label={i18n.t('screenshotView.zoomOut')}
                  className="flex items-center justify-center w-7 h-7 rounded-md border border-border bg-card/90 text-foreground backdrop-blur-sm transition-colors hover:bg-secondary hover:text-accent"
                >
                  <ZoomOut size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{i18n.t('screenshotView.zoomOut')}</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
