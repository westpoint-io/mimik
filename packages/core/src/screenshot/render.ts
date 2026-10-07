import type { Screenshot, ScreenshotBounds } from '@/core/guides/types';
import { drawAnnotation } from './draw';
import { resolveTarget, resolveViewport } from './geometry';

interface RenderOptions {
  format?: 'image/webp' | 'image/jpeg' | 'image/png';
  quality?: number;
  viewport?: ScreenshotBounds;
  target?: boolean;
}

export async function imageDimensions(file: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  bitmap.close();
  return { width, height };
}

export async function renderScreenshot(screenshot: Screenshot, opts: RenderOptions = {}): Promise<Blob> {
  const { format = 'image/webp', quality = 0.85 } = opts;
  const viewport = opts.viewport ?? resolveViewport(screenshot);
  const bitmap = await createImageBitmap(screenshot.blob);

  const canvas = new OffscreenCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, viewport.x, viewport.y, viewport.width, viewport.height, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  ctx.translate(-viewport.x, -viewport.y);

  const target = opts.target === false ? null : resolveTarget(screenshot);
  if (target) {
    drawAnnotation(
      ctx,
      {
        id: 'target',
        type: 'target',
        x: target.x,
        y: target.y,
        w: target.width,
        h: target.height,
        color: target.color,
        border: target.border,
      },
      viewport.x,
      viewport.y,
    );
  }

  for (const a of screenshot.edits?.annotations ?? []) drawAnnotation(ctx, a, viewport.x, viewport.y);

  return canvas.convertToBlob({ type: format, quality });
}
