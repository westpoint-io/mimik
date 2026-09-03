import { i18n } from '#imports';
import type { Branding } from '@/core/export/branding';
import { dataUrlToBytes, fitLogo, loadBranding } from '@/core/export/branding';
import type { ExportOptions } from '@/core/export/options';
import { loadExportOptions } from '@/core/export/options';
import { extractDomain, formatDate } from '@/core/export/utils';
import {
  FPS,
  FRAME_FILL,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  pickContainer,
  RESOLUTION_SPECS,
  STEP_SECONDS,
  STEP_ZOOM_TRANSITION_SEC,
  STEP_ZOOMED_OUT_SEC,
} from '@/core/export/video-support';
import { actionSteps, calloutAccent, isBlock } from '@/core/guides/blocks';
import type { BlockType, Guide, Screenshot, Step } from '@/core/guides/types';
import type { Ctx } from '@/core/screenshot/draw';
import { drawRoundedRect, TARGET_RADIUS, TARGET_STROKE } from '@/core/screenshot/draw';
import { clamp, resolveFrameViewport, resolveTarget } from '@/core/screenshot/geometry';
import { renderScreenshot } from '@/core/screenshot/render';

const TRANSITION_DURATION_SEC = 0.33;
const COVER_SECONDS = 3;
const KEY_FRAME_INTERVAL_SEC = 2;

const ZOOM_MIN = 1;
const ZOOM_MAX = 3.5;
const ZOOM_PAD_RATIO = 0.15;
const MAX_UPSCALE = 1.5;
const RESERVE_PASSES = 3;

const BACKDROP = '#1E1B4B';
const MUTED = '#9CA3AF';
const ON_DARK = '#FFFFFF';

const TOOLTIP_BG = 'rgba(17, 15, 43, 0.92)';
const TOOLTIP_FONT_SIZE = 20;
const TOOLTIP_LINE_HEIGHT = 27;
const TOOLTIP_PADDING_X = 16;
const TOOLTIP_PADDING_Y = 12;
const TOOLTIP_RADIUS = 10;
const TOOLTIP_GAP = 14;
const TOOLTIP_MAX_LINES = 3;
const TOOLTIP_MAX_WIDTH_RATIO = 0.45;
const FRAME_PADDING = 20;

const RING_DELAY_SEC = 0.12;
const RING_POP_SEC = 0.22;
const RING_OVERSHOOT = 0.16;
const RING_PAD = 7;
const TOOLTIP_DELAY_SEC = 0.37;
const TOOLTIP_FADE_SEC = 0.28;
const TOOLTIP_RISE = 8;

const CURSOR_START_SEC = 0.35;
const CURSOR_HEIGHT = 23;
const CURSOR_PAGE_RATIO = 0.026;
const CURSOR_MIN_SCALE = 0.9;
const CURSOR_MAX_SCALE = 2.6;
const CURSOR_PRESS_SEC = 0.16;
const CURSOR_PRESS_SCALE = 0.86;

const COVER_MARGIN = 96;
const COVER_CELL_WIDTH = 300;

const RENDER_OPTIONS = { format: 'image/webp', quality: 0.9 } as const;

const BLOCK_BLUR = 'blur(24px)';
const BLOCK_OVERSCAN = 1.12;
const BLOCK_WASH = 'rgba(30, 27, 75, 0.7)';
const BLOCK_WASH_FLAT = 'rgba(30, 27, 75, 0.86)';
const BLOCK_MAX_WIDTH_RATIO = 0.72;
const HEADING_FONT_SIZE = 58;
const HEADING_LINE_HEIGHT = 74;
const HEADING_MAX_LINES = 3;
const CALLOUT_FONT_SIZE = 36;
const CALLOUT_LINE_HEIGHT = 50;
const CALLOUT_MAX_LINES = 4;
const CALLOUT_BAR_WIDTH = 6;
const CALLOUT_BAR_GAP = 26;

export { FPS, STEP_SECONDS };

export function toFrames(seconds: number, fps = FPS): number {
  return Math.round(seconds * fps);
}

export function stepFrames(fps = FPS): number {
  return toFrames(STEP_SECONDS, fps);
}

export function overlapFrames(fps = FPS): number {
  return toFrames(TRANSITION_DURATION_SEC, fps);
}

export function totalStepFrames(stepCount: number, fps = FPS): number {
  if (stepCount <= 0) return 0;
  return stepCount * stepFrames(fps) - (stepCount - 1) * overlapFrames(fps);
}

export function zoomProgress(frame: number, fps = FPS): number {
  const held = toFrames(STEP_ZOOMED_OUT_SEC, fps);
  const moving = toFrames(STEP_ZOOM_TRANSITION_SEC, fps);
  if (frame <= held) return 0;
  if (frame >= held + moving) return 1;
  return (frame - held) / moving;
}

export function landingFrame(fps = FPS): number {
  return toFrames(STEP_ZOOMED_OUT_SEC + STEP_ZOOM_TRANSITION_SEC, fps);
}

function fadeAt(frame: number, startSec: number, spanSec: number, fps: number): number {
  const start = landingFrame(fps) + toFrames(startSec, fps);
  const span = toFrames(spanSec, fps);
  if (frame < start) return 0;
  if (span <= 0 || frame >= start + span) return 1;
  return (frame - start) / span;
}

export function ringProgress(frame: number, fps = FPS): number {
  return fadeAt(frame, RING_DELAY_SEC, RING_POP_SEC, fps);
}

export function tooltipProgress(frame: number, fps = FPS): number {
  return fadeAt(frame, TOOLTIP_DELAY_SEC, TOOLTIP_FADE_SEC, fps);
}

export function cursorProgress(frame: number, fps = FPS): number {
  const start = toFrames(CURSOR_START_SEC, fps);
  const land = landingFrame(fps);
  if (frame <= start) return 0;
  if (frame >= land) return 1;
  return (frame - start) / (land - start);
}

export function easeInOut(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Size {
  width: number;
  height: number;
}

export function findIdealZoomLevel(
  target: Rect,
  imgWidth: number,
  imgHeight: number,
  viewWidth: number,
  viewHeight: number,
): number {
  const nx = target.x / imgWidth;
  const ny = target.y / imgHeight;
  const needWidth = Math.min(target.width / imgWidth + 2 * ZOOM_PAD_RATIO, 1 - nx) * viewWidth;
  const needHeight = Math.min(target.height / imgHeight + 2 * ZOOM_PAD_RATIO, 1 - ny) * viewHeight;
  const zoom = Math.min(viewWidth / needWidth, viewHeight / needHeight);
  return Number.isFinite(zoom) ? clamp(zoom, ZOOM_MIN, sharpZoomCeiling(imgWidth, viewWidth)) : ZOOM_MIN;
}

export function sharpZoomCeiling(imgWidth: number, viewWidth = FRAME_WIDTH): number {
  if (!(imgWidth > 0) || !(viewWidth > 0)) return ZOOM_MAX;
  return clamp((imgWidth * MAX_UPSCALE) / viewWidth, ZOOM_MIN, ZOOM_MAX);
}

export function zoomCrop(
  image: Size,
  target: Rect | null,
  eased: number,
  viewWidth = FRAME_WIDTH,
  viewHeight = FRAME_HEIGHT,
): Rect {
  const full = { x: 0, y: 0, width: image.width, height: image.height };
  if (!target) return full;

  const zoom = findIdealZoomLevel(target, image.width, image.height, viewWidth, viewHeight);
  if (zoom <= ZOOM_MIN) return full;

  const width = image.width / zoom;
  const height = image.height / zoom;
  const x = clamp(target.x + target.width / 2 - width / 2, 0, image.width - width);
  const y = clamp(target.y + target.height / 2 - height / 2, 0, image.height - height);
  const t = clamp(eased, 0, 1);

  return {
    x: x * t,
    y: y * t,
    width: image.width + (width - image.width) * t,
    height: image.height + (height - image.height) * t,
  };
}

export function letterbox(srcWidth: number, srcHeight: number, dstWidth: number, dstHeight: number) {
  const scale = Math.min(dstWidth / srcWidth, dstHeight / srcHeight);
  const width = srcWidth * scale;
  const height = srcHeight * scale;
  return {
    scale,
    width,
    height,
    x: (dstWidth - width) / 2,
    y: (dstHeight - height) / 2,
  };
}

function coverFit(source: Size, overscan: number): Rect {
  const scale = Math.max(FRAME_WIDTH / source.width, FRAME_HEIGHT / source.height) * overscan;
  const width = source.width * scale;
  const height = source.height * scale;
  return {
    x: (FRAME_WIDTH - width) / 2,
    y: (FRAME_HEIGHT - height) / 2,
    width,
    height,
  };
}

export function wrapLines(
  text: string,
  maxWidth: number,
  measure: (line: string) => number,
  maxLines = TOOLTIP_MAX_LINES,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measure(candidate) > maxWidth) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) {
        lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
        return lines;
      }
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines;
}

export function tooltipBand(box: { height: number }): number {
  return box.height + TOOLTIP_GAP;
}

export function reserveTooltip(
  target: Rect,
  band: number,
  image: Size,
  fitHeight: number,
  viewWidth = FRAME_WIDTH,
  viewHeight = FRAME_HEIGHT,
): Rect {
  if (band <= 0 || fitHeight <= 0) return target;

  const below = target.y + target.height / 2 < image.height / 2;
  let rect = target;

  for (let pass = 0; pass < RESERVE_PASSES; pass++) {
    const zoom = findIdealZoomLevel(rect, image.width, image.height, viewWidth, viewHeight);
    const reserve = (band * image.height) / (zoom * fitHeight);
    const top = clamp(below ? target.y : target.y - reserve, 0, image.height);
    const bottom = clamp((below ? target.y + reserve : target.y) + target.height, top, image.height);
    rect = { x: target.x, y: top, width: target.width, height: bottom - top };
  }

  return rect;
}

export function tooltipPlacement(
  target: Rect,
  tooltip: { width: number; height: number },
  frameWidth = FRAME_WIDTH,
  frameHeight = FRAME_HEIGHT,
) {
  const below = target.y + target.height + TOOLTIP_GAP;
  const fitsBelow = below + tooltip.height <= frameHeight - FRAME_PADDING;
  const rawY = fitsBelow ? below : target.y - TOOLTIP_GAP - tooltip.height;
  const rawX = target.x + target.width / 2 - tooltip.width / 2;
  return {
    x: clamp(rawX, FRAME_PADDING, Math.max(FRAME_PADDING, frameWidth - tooltip.width - FRAME_PADDING)),
    y: clamp(rawY, FRAME_PADDING, Math.max(FRAME_PADDING, frameHeight - tooltip.height - FRAME_PADDING)),
    below: fitsBelow,
  };
}

function logoBitmap(logo: NonNullable<Branding['logo']>): Promise<ImageBitmap> {
  const bytes = dataUrlToBytes(logo.dataUrl);
  return createImageBitmap(new Blob([bytes as BlobPart]));
}

interface TooltipBox {
  lines: string[];
  width: number;
  height: number;
}

function measureTooltip(ctx: Ctx, text: string): TooltipBox | null {
  ctx.font = `500 ${TOOLTIP_FONT_SIZE}px Poppins, sans-serif`;
  const lines = wrapLines(text, FRAME_WIDTH * TOOLTIP_MAX_WIDTH_RATIO, (line) => ctx.measureText(line).width);
  if (lines.length === 0) return null;

  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  return {
    lines,
    width: textWidth + TOOLTIP_PADDING_X * 2,
    height: lines.length * TOOLTIP_LINE_HEIGHT + TOOLTIP_PADDING_Y * 2,
  };
}

function drawTooltip(ctx: Ctx, box: TooltipBox, target: Rect) {
  const at = tooltipPlacement(target, box);

  ctx.fillStyle = TOOLTIP_BG;
  drawRoundedRect(ctx, at.x, at.y, box.width, box.height, TOOLTIP_RADIUS);
  ctx.fill();

  ctx.fillStyle = ON_DARK;
  ctx.textBaseline = 'top';
  box.lines.forEach((line, i) => {
    ctx.fillText(line, at.x + TOOLTIP_PADDING_X, at.y + TOOLTIP_PADDING_Y + i * TOOLTIP_LINE_HEIGHT);
  });
}

interface Point {
  x: number;
  y: number;
}

export const CURSOR_ENTRY_ORIGIN: Point = { x: 0.5, y: 1.08 };

export function cursorOriginFor(index: number, targetAt: (i: number) => Point | null): Point {
  for (let i = index - 1; i >= 0; i--) {
    const behind = targetAt(i);
    if (behind) return behind;
  }
  return CURSOR_ENTRY_ORIGIN;
}

interface ScreenshotLayer {
  kind: 'screenshot';
  bitmap: ImageBitmap;
  fit: ReturnType<typeof letterbox>;
  target: Rect | null;
  ring: { color: string; dashed: boolean } | null;
  from: Point;
  description: string;
}

interface BlockLayer {
  kind: 'block';
  blockType: BlockType;
  accent: string;
  description: string;
  backdrop: ImageBitmap | null;
  blurred: boolean;
}

type StepLayer = ScreenshotLayer | BlockLayer;

function detectCanvasFilter(): boolean {
  try {
    const ctx = new OffscreenCanvas(1, 1).getContext('2d');
    if (!ctx || !('filter' in ctx)) return false;
    ctx.filter = BLOCK_BLUR;
    const applied = ctx.filter !== 'none';
    ctx.filter = 'none';
    return applied;
  } catch {
    return false;
  }
}

let filterSupport: boolean | undefined;

function supportsCanvasFilter(): boolean {
  filterSupport ??= detectCanvasFilter();
  return filterSupport;
}

async function blurBackdrop(screenshot: Screenshot): Promise<Pick<BlockLayer, 'backdrop' | 'blurred'>> {
  const canvas = new OffscreenCanvas(FRAME_WIDTH, FRAME_HEIGHT);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const rendered = await renderScreenshot(screenshot, {
    ...RENDER_OPTIONS,
    viewport: resolveFrameViewport(screenshot),
  });
  const source = await createImageBitmap(rendered);
  const blurred = supportsCanvasFilter();
  const at = coverFit(source, blurred ? BLOCK_OVERSCAN : 1);

  if (blurred) ctx.filter = BLOCK_BLUR;
  ctx.drawImage(source, at.x, at.y, at.width, at.height);
  ctx.filter = 'none';
  source.close();

  return { backdrop: await createImageBitmap(canvas), blurred };
}

async function loadBlockLayer(step: Step, behind: Screenshot | undefined): Promise<BlockLayer> {
  return {
    kind: 'block',
    blockType: step.blockType ?? 'callout',
    accent: calloutAccent(step),
    description: step.description,
    ...(behind ? await blurBackdrop(behind) : { backdrop: null, blurred: false }),
  };
}

export function normalizedTargetCenter(screenshot: Screenshot): Point | null {
  const target = resolveTarget(screenshot);
  if (!target) return null;
  const viewport = resolveFrameViewport(screenshot);
  if (!(viewport.width > 0) || !(viewport.height > 0)) return null;
  return {
    x: clamp((target.x + target.width / 2 - viewport.x) / viewport.width, 0, 1),
    y: clamp((target.y + target.height / 2 - viewport.y) / viewport.height, 0, 1),
  };
}

async function loadScreenshotLayer(step: Step, screenshot: Screenshot, from: Point): Promise<ScreenshotLayer> {
  const viewport = resolveFrameViewport(screenshot);
  const rendered = await renderScreenshot(screenshot, {
    ...RENDER_OPTIONS,
    viewport,
    target: false,
  });
  const bitmap = await createImageBitmap(rendered);
  const target = resolveTarget(screenshot);
  const sx = bitmap.width / viewport.width;
  const sy = bitmap.height / viewport.height;

  return {
    kind: 'screenshot',
    bitmap,
    fit: letterbox(bitmap.width, bitmap.height, FRAME_WIDTH, FRAME_HEIGHT),
    target: target
      ? {
          x: (target.x - viewport.x) * sx,
          y: (target.y - viewport.y) * sy,
          width: target.width * sx,
          height: target.height * sy,
        }
      : null,
    ring: target ? { color: target.color, dashed: target.border === 'dashed' } : null,
    from: { x: from.x * bitmap.width, y: from.y * bitmap.height },
    description: step.description,
  };
}

function releaseLayer(layer: StepLayer) {
  if (layer.kind === 'screenshot') layer.bitmap.close();
  else layer.backdrop?.close();
}

function drawBlockText(ctx: Ctx, layer: BlockLayer) {
  const heading = layer.blockType === 'heading';
  const fontSize = heading ? HEADING_FONT_SIZE : CALLOUT_FONT_SIZE;
  const lineHeight = heading ? HEADING_LINE_HEIGHT : CALLOUT_LINE_HEIGHT;

  ctx.font = `700 ${fontSize}px Poppins, sans-serif`;
  const lines = wrapLines(
    layer.description,
    FRAME_WIDTH * BLOCK_MAX_WIDTH_RATIO,
    (line) => ctx.measureText(line).width,
    heading ? HEADING_MAX_LINES : CALLOUT_MAX_LINES,
  );
  if (lines.length === 0) return;

  const middle = FRAME_HEIGHT / 2;
  const height = lines.length * lineHeight;
  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const centerX = FRAME_WIDTH / 2 + (heading ? 0 : (CALLOUT_BAR_WIDTH + CALLOUT_BAR_GAP) / 2);

  if (!heading) {
    ctx.fillStyle = layer.accent;
    const barX = centerX - textWidth / 2 - CALLOUT_BAR_GAP - CALLOUT_BAR_WIDTH;
    drawRoundedRect(ctx, barX, middle - height / 2, CALLOUT_BAR_WIDTH, height, CALLOUT_BAR_WIDTH / 2);
    ctx.fill();
  }

  ctx.fillStyle = ON_DARK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    ctx.fillText(line, centerX, middle + (i - (lines.length - 1) / 2) * lineHeight);
  });
}

function drawBlockFrame(ctx: Ctx, layer: BlockLayer) {
  ctx.save();
  if (layer.backdrop) {
    ctx.drawImage(layer.backdrop, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    ctx.fillStyle = layer.blurred ? BLOCK_WASH : BLOCK_WASH_FLAT;
  } else {
    ctx.fillStyle = BACKDROP;
  }
  ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  drawBlockText(ctx, layer);
  ctx.restore();
}

function drawRing(ctx: Ctx, at: Rect, ring: NonNullable<ScreenshotLayer['ring']>, progress: number) {
  const pad = RING_PAD * (1 + RING_OVERSHOOT * (1 - progress) ** 2);
  ctx.save();
  ctx.globalAlpha *= progress;
  ctx.strokeStyle = ring.color;
  ctx.lineWidth = TARGET_STROKE;
  if (ring.dashed) ctx.setLineDash([8, 5]);
  drawRoundedRect(ctx, at.x - pad, at.y - pad, at.width + pad * 2, at.height + pad * 2, TARGET_RADIUS);
  ctx.stroke();
  ctx.restore();
}

export function cursorScale(imageHeight: number, cameraScale: number): number {
  if (!(imageHeight > 0) || !(cameraScale > 0)) return CURSOR_MIN_SCALE;
  const onPage = (imageHeight * CURSOR_PAGE_RATIO) / CURSOR_HEIGHT;
  return clamp(onPage * cameraScale, CURSOR_MIN_SCALE, CURSOR_MAX_SCALE);
}

function drawCursor(ctx: Ctx, x: number, y: number, scale: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 20);
  ctx.lineTo(5.2, 15.2);
  ctx.lineTo(8.6, 23);
  ctx.lineTo(12.2, 21.4);
  ctx.lineTo(8.8, 13.8);
  ctx.lineTo(15.6, 13.2);
  ctx.closePath();
  ctx.fillStyle = ON_DARK;
  ctx.strokeStyle = BACKDROP;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawStepFrame(ctx: Ctx, layer: StepLayer, frame: number, device: Size) {
  if (layer.kind === 'block') {
    drawBlockFrame(ctx, layer);
    return;
  }

  const { fit } = layer;
  const box = layer.description ? measureTooltip(ctx, layer.description) : null;
  const framed =
    box && layer.target
      ? reserveTooltip(layer.target, tooltipBand(box), layer.bitmap, fit.height, device.width, device.height)
      : layer.target;

  const crop = zoomCrop(layer.bitmap, framed, easeInOut(zoomProgress(frame)), device.width, device.height);
  ctx.drawImage(layer.bitmap, crop.x, crop.y, crop.width, crop.height, fit.x, fit.y, fit.width, fit.height);

  const scale = fit.width / crop.width;
  const project = (x: number, y: number) => ({
    x: fit.x + (x - crop.x) * scale,
    y: fit.y + (y - crop.y) * scale,
  });

  const anchor: Rect = layer.target
    ? {
        ...project(layer.target.x, layer.target.y),
        width: layer.target.width * scale,
        height: layer.target.height * scale,
      }
    : { x: FRAME_WIDTH / 2, y: FRAME_HEIGHT, width: 0, height: 0 };

  const ringIn = ringProgress(frame);
  if (layer.target && layer.ring && ringIn > 0) drawRing(ctx, anchor, layer.ring, ringIn);

  const tipIn = tooltipProgress(frame);
  if (box && tipIn > 0) {
    ctx.save();
    ctx.globalAlpha *= tipIn;
    ctx.translate(0, (1 - tipIn) * -TOOLTIP_RISE);
    drawTooltip(ctx, box, anchor);
    ctx.restore();
  }

  if (layer.target) {
    const travel = easeInOut(cursorProgress(frame));
    const tip = project(
      layer.from.x + (layer.target.x + layer.target.width * 0.42 - layer.from.x) * travel,
      layer.from.y + (layer.target.y + layer.target.height * 0.55 - layer.from.y) * travel,
    );
    const pressed = ringIn > 0 && frame < landingFrame() + toFrames(RING_DELAY_SEC + CURSOR_PRESS_SEC);
    const size = cursorScale(layer.bitmap.height, scale) * (pressed ? CURSOR_PRESS_SCALE : 1);
    drawCursor(ctx, tip.x, tip.y, size);
  }
}

async function drawCardFrame(ctx: Ctx, guide: Guide, steps: Step[], brand: Branding, label: string) {
  ctx.fillStyle = BACKDROP;
  ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  ctx.textBaseline = 'top';

  let y = 150;
  ctx.fillStyle = MUTED;
  ctx.font = '700 14px Poppins, sans-serif';
  ctx.fillText(label.toUpperCase(), COVER_MARGIN, y);
  y += 34;

  ctx.fillStyle = ON_DARK;
  ctx.font = '700 52px Poppins, sans-serif';
  const titleWidth = FRAME_WIDTH - COVER_MARGIN * 2 - (brand.logo ? 240 : 0);
  for (const line of wrapLines(guide.title, titleWidth, (l) => ctx.measureText(l).width, 2)) {
    ctx.fillText(line, COVER_MARGIN, y);
    y += 64;
  }

  y += 26;
  ctx.strokeStyle = brand.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(COVER_MARGIN, y);
  ctx.lineTo(FRAME_WIDTH - COVER_MARGIN, y);
  ctx.stroke();
  y += 26;

  const domain = extractDomain(steps);
  const cells: Array<[string, string]> = [
    [i18n.t('export.steps').toUpperCase(), String(steps.length).padStart(2, '0')],
    [i18n.t('export.created').toUpperCase(), formatDate(guide.createdAt)],
  ];
  if (domain) cells.push([i18n.t('export.source').toUpperCase(), domain]);

  cells.forEach(([label, value], index) => {
    const x = COVER_MARGIN + index * COVER_CELL_WIDTH;
    ctx.fillStyle = MUTED;
    ctx.font = '700 12px Poppins, sans-serif';
    ctx.fillText(label, x, y);
    ctx.fillStyle = index === 0 ? brand.accent : ON_DARK;
    ctx.font = '700 30px Poppins, sans-serif';
    ctx.fillText(value, x, y + 20);
  });

  if (brand.logo) {
    const size = fitLogo(brand.logo, 200, 64);
    const bitmap = await logoBitmap(brand.logo);
    ctx.drawImage(bitmap, FRAME_WIDTH - COVER_MARGIN - size.width, 132, size.width, size.height);
    bitmap.close();
  }

  const footer = [brand.footer, brand.attribution ? i18n.t('export.madeWith') : ''].filter(Boolean).join('   ·   ');
  if (footer) {
    ctx.fillStyle = MUTED;
    ctx.font = '500 15px Poppins, sans-serif';
    ctx.fillText(footer, COVER_MARGIN, FRAME_HEIGHT - 96);
  }
}

export type VideoOptions = Pick<ExportOptions, 'cover' | 'stepDescriptions' | 'resolution'>;

export interface VideoExportControls {
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export type StepKind = 'click' | 'type' | 'key' | 'navigate' | 'note';

export interface VideoChapter {
  stepId: string;
  title: string;
  kind: StepKind;
  start: number;
  end: number;
}

export function stepKind(step: Step): StepKind {
  if (isBlock(step)) return 'note';
  const action = step.action ?? '';
  if (action.startsWith('keydown:')) return 'key';
  if (action === 'input') return 'type';
  if (action === 'navigate') return 'navigate';
  return 'click';
}

export interface VideoExportResult {
  blob: Blob;
  extension: string;
  chapters: VideoChapter[];
}

export function videoChapters(frames: Step[], cover: boolean, fps = FPS): VideoChapter[] {
  if (frames.length === 0) return [];
  const offset = cover ? COVER_SECONDS : 0;
  const stride = (stepFrames(fps) - overlapFrames(fps)) / fps;
  const last = offset + totalStepFrames(frames.length, fps) / fps;

  return frames.map((step, index) => ({
    stepId: step.id,
    title: step.description?.trim() || i18n.t('export.stepLabel', [String(index + 1)]),
    kind: stepKind(step),
    start: offset + index * stride,
    end: index === frames.length - 1 ? last : offset + (index + 1) * stride,
  }));
}

export async function exportGuideAsVideo(
  guide: Guide,
  steps: Step[],
  screenshots: Map<string, Screenshot>,
  exportOptions?: VideoOptions,
  controls: VideoExportControls = {},
): Promise<VideoExportResult> {
  const frames = steps.filter((step) => isBlock(step) || screenshots.has(step.id));
  if (frames.length === 0) throw new Error('This guide has no screenshots to turn into a video');

  const { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat } = await import(
    'mediabunny'
  );

  const [brand, options] = await Promise.all([
    loadBranding(),
    exportOptions ? Promise.resolve(exportOptions) : loadExportOptions(),
  ]);

  const requested = RESOLUTION_SPECS[options.resolution] ? options.resolution : '720p';
  const preferred = await pickContainer(requested);
  const resolution = preferred ? requested : '720p';
  const container = preferred ?? (await pickContainer('720p'));
  if (!container) throw new Error('This browser cannot encode video');
  const mp4 = container === 'mp4';
  const spec = RESOLUTION_SPECS[resolution];

  const canvas = document.createElement('canvas');
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.scale(spec.width / FRAME_WIDTH, spec.height / FRAME_HEIGHT);
  const device = { width: spec.width, height: spec.height };

  const output = new Output({
    format: mp4 ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, {
    codec: mp4 ? 'avc' : 'vp9',
    quality: QUALITY_HIGH,
    keyFrameInterval: KEY_FRAME_INTERVAL_SEC,
  });
  output.addVideoTrack(source);
  await output.start();

  const span = stepFrames();
  const overlap = overlapFrames();
  const stride = span - overlap;
  const stepTotal = totalStepFrames(frames.length);
  const total = stepTotal + (options.cover ? 2 : 0);
  const loaded = new Map<number, StepLayer>();
  const { onProgress, signal } = controls;
  let done = 0;

  const backdropFor = (index: number) => {
    for (let i = index - 1; i >= 0; i--) {
      const behind = screenshots.get(frames[i].id);
      if (behind) return behind;
    }
    return undefined;
  };

  const targetAt = (index: number) => {
    const behind = screenshots.get(frames[index].id);
    return behind ? normalizedTargetCenter(behind) : null;
  };

  const layerAt = async (index: number) => {
    const cached = loaded.get(index);
    if (cached) return cached;
    const step = frames[index];
    const layer = isBlock(step)
      ? await loadBlockLayer(step, backdropFor(index))
      : await loadScreenshotLayer(step, screenshots.get(step.id) as Screenshot, cursorOriginFor(index, targetAt));
    if (layer.kind === 'screenshot' && !options.stepDescriptions) layer.description = '';
    loaded.set(index, layer);
    return layer;
  };

  const releaseBefore = (index: number) => {
    for (const [key, layer] of loaded) {
      if (key < index) {
        releaseLayer(layer);
        loaded.delete(key);
      }
    }
  };

  const abortIfRequested = () => {
    if (signal?.aborted) throw new DOMException('Video export was aborted', 'AbortError');
  };

  try {
    const offset = options.cover ? COVER_SECONDS : 0;

    const cards = actionSteps(frames);

    if (options.cover) {
      abortIfRequested();
      await drawCardFrame(ctx, guide, cards, brand, i18n.t('export.guideLabel'));
      await source.add(0, COVER_SECONDS);
      done += 1;
      onProgress?.(done, total);
    }

    for (let frame = 0; frame < stepTotal; frame++) {
      abortIfRequested();

      const index = Math.min(Math.floor(frame / stride), frames.length - 1);
      const local = frame - index * stride;
      const outgoing = index > 0 && local < overlap ? index - 1 : -1;

      const current = await layerAt(index);
      const previous = outgoing >= 0 ? await layerAt(outgoing) : null;
      releaseBefore(outgoing >= 0 ? outgoing : index);

      ctx.globalAlpha = 1;
      ctx.fillStyle = FRAME_FILL;
      ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);

      if (previous) {
        drawStepFrame(ctx, previous, local + stride, device);
        ctx.globalAlpha = (local + 1) / overlap;
        drawStepFrame(ctx, current, local, device);
        ctx.globalAlpha = 1;
      } else {
        drawStepFrame(ctx, current, local, device);
      }

      await source.add(offset + frame / FPS, 1 / FPS);
      done += 1;
      onProgress?.(done, total);
    }

    if (options.cover) {
      abortIfRequested();
      await drawCardFrame(ctx, guide, cards, brand, i18n.t('export.endLabel'));
      await source.add(offset + stepTotal / FPS, COVER_SECONDS);
      done += 1;
      onProgress?.(done, total);
    }

    await output.finalize();
  } catch (error) {
    await output.cancel();
    throw error;
  } finally {
    for (const layer of loaded.values()) releaseLayer(layer);
    loaded.clear();
  }

  const buffer = output.target.buffer;
  if (!buffer) throw new Error('Video encoding produced no output');

  return {
    blob: new Blob([buffer], { type: mp4 ? 'video/mp4' : 'video/webm' }),
    extension: mp4 ? 'mp4' : 'webm',
    chapters: videoChapters(frames, Boolean(options.cover)),
  };
}
