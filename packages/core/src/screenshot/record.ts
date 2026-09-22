import type { ElementMeta, ScreenshotBounds, StoredScreenshot } from '@/core/guides/types';
import { type CursorMark, DEFAULT_TARGET_COLOR } from '@/core/screenshot/types';

export type ZoomMode = 'element' | 'click' | 'none';

const CLICK_ZOOM_FRACTION = 0.55;
const MIN_CLICK_ZOOM_WIDTH = 1100;

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
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clickZoomViewport(width: number, height: number, click: { x: number; y: number }): ScreenshotBounds {
  const visWidth = Math.min(width, Math.max(width * CLICK_ZOOM_FRACTION, MIN_CLICK_ZOOM_WIDTH));
  const visHeight = Math.min(height, (visWidth * height) / width);
  return {
    x: clamp(click.x - visWidth / 2, 0, width - visWidth),
    y: clamp(click.y - visHeight / 2, 0, height - visHeight),
    width: visWidth,
    height: visHeight,
  };
}

export function screenshotForElement(bytes: ScreenshotBytes, meta: ElementMeta): StoredScreenshot {
  const { cursor, targetColor, zoom = 'element', ...rest } = bytes;
  const ratio = meta.devicePixelRatio;
  const click = meta.clickPoint ?? { x: meta.rect.x + meta.rect.width / 2, y: meta.rect.y + meta.rect.height / 2 };
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
        ? { viewport: clickZoomViewport(rest.width, rest.height, { x: click.x * ratio, y: click.y * ratio }) }
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
