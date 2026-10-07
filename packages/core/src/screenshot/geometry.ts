import type { Screenshot, ScreenshotBounds } from '@/core/guides/types';
import type { Annotation, ClickTarget } from './types';
import { DEFAULT_TARGET_COLOR } from './types';

const PAD_RATIO = 0.3;
const MAX_PAD_MULTIPLE = 6;

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function hasArea<T extends { width: number; height: number }>(rect: T | null | undefined): rect is T {
  return !!rect && rect.width > 0 && rect.height > 0;
}

export function resolveFrameViewport(screenshot: Screenshot): ScreenshotBounds {
  return screenshot.edits?.viewport ?? { x: 0, y: 0, width: screenshot.width, height: screenshot.height };
}

export function resolveViewport(screenshot: Screenshot): ScreenshotBounds {
  const imgW = screenshot.width;
  const imgH = screenshot.height;
  const explicit = screenshot.edits?.viewport;
  if (explicit) return explicit;

  const bounds = screenshot.bounds;
  if (!hasArea(bounds)) return { x: 0, y: 0, width: imgW, height: imgH };

  const dpr = screenshot.pixelRatio || 1;
  const bx = bounds.x * dpr;
  const by = bounds.y * dpr;
  const bw = bounds.width * dpr;
  const bh = bounds.height * dpr;

  const imgAspect = imgW / imgH;
  const elAspect = bw / bh;

  let visW = bw + Math.min(PAD_RATIO * imgW, bw * MAX_PAD_MULTIPLE);
  let visH = bh + Math.min(PAD_RATIO * imgH, bh * MAX_PAD_MULTIPLE);

  if (elAspect > 1) {
    visH = visW / imgAspect;
  } else if (elAspect < 1) {
    visW = visH * imgAspect;
  }

  visW = Math.min(visW, imgW);
  visH = Math.min(visH, imgH);

  return {
    x: clamp(bx + bw / 2 - visW / 2, 0, imgW - visW),
    y: clamp(by + bh / 2 - visH / 2, 0, imgH - visH),
    width: visW,
    height: visH,
  };
}

const RATIO_BUCKET_PRECISION = 100;

export function dominantRatio(screenshots: Map<string, Screenshot>): number | undefined {
  const buckets = new Map<number, { ratio: number; count: number }>();

  for (const screenshot of screenshots.values()) {
    const viewport = resolveViewport(screenshot);
    if (!viewport.width || !viewport.height) continue;
    const ratio = viewport.width / viewport.height;
    const key = Math.round(ratio * RATIO_BUCKET_PRECISION) / RATIO_BUCKET_PRECISION;
    const bucket = buckets.get(key);
    if (bucket) bucket.count += 1;
    else buckets.set(key, { ratio, count: 1 });
  }

  let winner: { ratio: number; count: number } | undefined;
  for (const bucket of buckets.values()) {
    if (!winner || bucket.count > winner.count) winner = bucket;
  }
  return winner?.ratio;
}

const MIN_VIEWPORT = 40;
const MIN_ANNOTATION = 8;

interface ImageSize {
  width: number;
  height: number;
}

function fitRect(rect: ScreenshotBounds, img: ImageSize): ScreenshotBounds {
  const width = Math.min(rect.width, img.width);
  const height = Math.min(rect.height, img.height);
  return {
    width,
    height,
    x: clamp(rect.x, 0, img.width - width),
    y: clamp(rect.y, 0, img.height - height),
  };
}

export function zoomBy(viewport: ScreenshotBounds, factor: number, img: ImageSize): ScreenshotBounds {
  const cx = viewport.x + viewport.width / 2;
  const cy = viewport.y + viewport.height / 2;
  const width = clamp(viewport.width / factor, MIN_VIEWPORT, img.width);
  const height = clamp(viewport.height / factor, MIN_VIEWPORT, img.height);
  return fitRect({ x: cx - width / 2, y: cy - height / 2, width, height }, img);
}

export function panBy(viewport: ScreenshotBounds, dx: number, dy: number, img: ImageSize): ScreenshotBounds {
  return fitRect({ ...viewport, x: viewport.x + dx, y: viewport.y + dy }, img);
}

export function cropTo(rect: ScreenshotBounds, img: ImageSize): ScreenshotBounds {
  const x0 = rect.width < 0 ? rect.x + rect.width : rect.x;
  const y0 = rect.height < 0 ? rect.y + rect.height : rect.y;
  const width0 = Math.abs(rect.width);
  const height0 = Math.abs(rect.height);
  const x = clamp(x0, 0, img.width);
  const y = clamp(y0, 0, img.height);
  return {
    x,
    y,
    width: clamp(width0, 0, img.width - x),
    height: clamp(height0, 0, img.height - y),
  };
}

const HIT_PAD = 8;

export type Handle = 'nw' | 'ne' | 'sw' | 'se';

export function annotationBounds(a: Annotation): ScreenshotBounds {
  switch (a.type) {
    case 'box':
    case 'ellipse':
    case 'redact':
    case 'target':
      return { x: a.x, y: a.y, width: a.w, height: a.h };
    case 'arrow':
      return {
        x: Math.min(a.x1, a.x2),
        y: Math.min(a.y1, a.y2),
        width: Math.abs(a.x2 - a.x1),
        height: Math.abs(a.y2 - a.y1),
      };
    case 'text':
      return {
        x: a.x,
        y: a.y - a.size,
        width: a.w ?? a.text.length * a.size * 0.6,
        height: a.h ?? a.size * 1.4,
      };
    case 'freehand': {
      const xs = a.points.filter((_, i) => i % 2 === 0);
      const ys = a.points.filter((_, i) => i % 2 === 1);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    }
  }
}

export function hitTest(annotations: Annotation[], x: number, y: number): Annotation | null {
  for (let i = annotations.length - 1; i >= 0; i--) {
    const b = annotationBounds(annotations[i]!);
    if (x >= b.x - HIT_PAD && x <= b.x + b.width + HIT_PAD && y >= b.y - HIT_PAD && y <= b.y + b.height + HIT_PAD) {
      return annotations[i]!;
    }
  }
  return null;
}

export function moveAnnotation(a: Annotation, dx: number, dy: number): Annotation {
  switch (a.type) {
    case 'box':
    case 'ellipse':
    case 'redact':
    case 'target':
    case 'text':
      return { ...a, x: a.x + dx, y: a.y + dy };
    case 'arrow':
      return { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy };
    case 'freehand':
      return { ...a, points: a.points.map((p, i) => (i % 2 === 0 ? p + dx : p + dy)) };
  }
}

export function resizeAnnotation(a: Annotation, handle: Handle, dx: number, dy: number): Annotation {
  const left = handle === 'nw' || handle === 'sw';
  const top = handle === 'nw' || handle === 'ne';

  if (a.type === 'text') {
    const b = annotationBounds(a);
    const height = Math.max(MIN_ANNOTATION, top ? b.height - dy : b.height + dy);
    const scale = height / b.height;
    return {
      ...a,
      y: top ? a.y + dy : a.y,
      size: Math.max(MIN_ANNOTATION, a.size * scale),
      w: (a.w ?? b.width) * scale,
      h: height,
    };
  }

  if (a.type === 'arrow' || a.type === 'freehand') {
    const b = annotationBounds(a);
    const width = Math.max(MIN_ANNOTATION, left ? b.width - dx : b.width + dx);
    const height = Math.max(MIN_ANNOTATION, top ? b.height - dy : b.height + dy);
    const sx = b.width ? width / b.width : 1;
    const sy = b.height ? height / b.height : 1;
    const ax = left ? b.x + b.width : b.x;
    const ay = top ? b.y + b.height : b.y;
    const mapX = (x: number) => ax + (x - ax) * sx;
    const mapY = (y: number) => ay + (y - ay) * sy;
    if (a.type === 'arrow') {
      return { ...a, x1: mapX(a.x1), y1: mapY(a.y1), x2: mapX(a.x2), y2: mapY(a.y2) };
    }
    return { ...a, points: a.points.map((p, i) => (i % 2 === 0 ? mapX(p) : mapY(p))) };
  }

  return {
    ...a,
    x: left ? a.x + dx : a.x,
    y: top ? a.y + dy : a.y,
    w: Math.max(MIN_ANNOTATION, left ? a.w - dx : a.w + dx),
    h: Math.max(MIN_ANNOTATION, top ? a.h - dy : a.h + dy),
  };
}

export type TargetSource = Pick<Screenshot, 'edits' | 'bounds' | 'pixelRatio'>;

export function resolveTarget(screenshot: TargetSource): ClickTarget | null {
  const explicit = screenshot.edits?.target;
  if (explicit !== undefined) return hasArea(explicit) ? explicit : null;

  const bounds = screenshot.bounds;
  if (!hasArea(bounds)) return null;

  const dpr = screenshot.pixelRatio || 1;
  return {
    x: bounds.x * dpr,
    y: bounds.y * dpr,
    width: bounds.width * dpr,
    height: bounds.height * dpr,
    border: 'dashed',
    color: DEFAULT_TARGET_COLOR,
  };
}
