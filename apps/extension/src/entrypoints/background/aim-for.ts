import type { ElementMeta } from '@/core/guides/types';

export function aimFor(meta: ElementMeta, shot: { width: number; height: number }) {
  const point = meta.clickPoint ?? { x: meta.rect.x + meta.rect.width / 2, y: meta.rect.y + meta.rect.height / 2 };
  const scale = meta.devicePixelRatio || 1;
  return {
    x: (point.x * scale) / shot.width,
    y: (point.y * scale) / shot.height,
    aspect: shot.width / shot.height,
  };
}
