import type { ElementMeta, StoredScreenshot } from '@/core/guides/types';
import { type CursorMark, DEFAULT_TARGET_COLOR } from '@/core/screenshot/types';

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
  zoomToTarget?: boolean;
}

export function screenshotForElement(bytes: ScreenshotBytes, meta: ElementMeta): StoredScreenshot {
  const { cursor, targetColor, zoomToTarget = true, ...rest } = bytes;
  const ratio = meta.devicePixelRatio;
  return {
    ...rest,
    ...(zoomToTarget
      ? { bounds: { x: meta.rect.x, y: meta.rect.y, width: meta.rect.width, height: meta.rect.height } }
      : {}),
    pixelRatio: ratio,
    clickPoint: meta.clickPoint,
    edits: {
      ...(cursor === undefined ? {} : { cursor }),
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
