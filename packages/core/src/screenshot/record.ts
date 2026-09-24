import type { ElementMeta, ScreenshotBounds, StoredScreenshot } from '@/core/guides/types';
import { type CursorMark, DEFAULT_TARGET_COLOR, type ScreenshotEdits } from '@/core/screenshot/types';

export type ZoomMode = 'element' | 'click' | 'none';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;
export const ZOOM_STEP = 0.25;

const GUIDE_CONTENT_WIDTH = 780;

export interface ScreenshotBytes {
  id: string;
  stepId: string;
  mimeType: string;
  width: number;
  height: number;
  blob?: Blob;
  src?: string;
  cursor?: CursorMark | null;
  targetColor?: string;
  zoom?: ZoomMode;
  zoomLevel?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function snapZoom(zoom: number): number {
  return clamp(Math.round(zoom / ZOOM_STEP) * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
}

export function autoZoom(width: number, pixelRatio: number): number {
  return snapZoom(width / (GUIDE_CONTENT_WIDTH * (pixelRatio || 1)));
}

export function clickZoomViewport(
  width: number,
  height: number,
  click: { x: number; y: number },
  zoom: number,
): ScreenshotBounds {
  const visWidth = width / snapZoom(zoom);
  const visHeight = (visWidth * height) / width;
  return {
    x: clamp(click.x - visWidth / 2, 0, width - visWidth),
    y: clamp(click.y - visHeight / 2, 0, height - visHeight),
    width: visWidth,
    height: visHeight,
  };
}

export function screenshotForElement(bytes: ScreenshotBytes, meta: ElementMeta): StoredScreenshot {
  const { cursor, targetColor, zoom = 'element', zoomLevel, ...rest } = bytes;
  const ratio = meta.devicePixelRatio;
  const click = meta.clickPoint ?? { x: meta.rect.x + meta.rect.width / 2, y: meta.rect.y + meta.rect.height / 2 };
  const level = zoomLevel ?? autoZoom(rest.width, ratio);
  return {
    ...rest,
    ...(zoom === 'element'
      ? { bounds: { x: meta.rect.x, y: meta.rect.y, width: meta.rect.width, height: meta.rect.height } }
      : {}),
    pixelRatio: ratio,
    clickPoint: meta.clickPoint,
    edits: {
      ...(cursor === undefined ? {} : { cursor }),
      ...(zoom === 'click'
        ? {
            zoomLevel: level,
            zoomAuto: zoomLevel === undefined,
            viewport: clickZoomViewport(rest.width, rest.height, { x: click.x * ratio, y: click.y * ratio }, level),
          }
        : {}),
      target: {
        x: meta.rect.x * ratio,
        y: meta.rect.y * ratio,
        width: meta.rect.width * ratio,
        height: meta.rect.height * ratio,
        border: 'dashed',
        color: targetColor || DEFAULT_TARGET_COLOR,
      },
    },
  };
}

export function rezoomEdits(screenshot: StoredScreenshot, level: number | null): ScreenshotEdits | null {
  if (screenshot.edits?.zoomLevel === undefined) return null;
  const click = screenshot.clickPoint;
  if (!click) return null;
  const ratio = screenshot.pixelRatio || 1;
  const next = level ?? autoZoom(screenshot.width, ratio);
  if (next === screenshot.edits.zoomLevel && isAutoZoom(screenshot) === (level === null)) return null;
  return {
    ...screenshot.edits,
    zoomLevel: next,
    zoomAuto: level === null,
    viewport: clickZoomViewport(screenshot.width, screenshot.height, { x: click.x * ratio, y: click.y * ratio }, next),
  };
}

function isAutoZoom(screenshot: StoredScreenshot): boolean {
  return (
    screenshot.edits?.zoomAuto ?? screenshot.edits?.zoomLevel === autoZoom(screenshot.width, screenshot.pixelRatio || 1)
  );
}

export function currentZoom(screenshots: Iterable<StoredScreenshot>): number | 'auto' | null {
  const levels = new Set<number | 'auto'>();
  for (const shot of screenshots) {
    if (shot.edits?.zoomLevel === undefined) continue;
    levels.add(isAutoZoom(shot) ? 'auto' : shot.edits.zoomLevel);
  }
  return levels.size === 1 ? [...levels][0] : null;
}
