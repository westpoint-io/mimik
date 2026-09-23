import type { ScreenshotBounds } from '@mimik/core/guides/types';
import type { Handle } from '@mimik/core/screenshot/geometry';

export function handleCorners(b: ScreenshotBounds): [Handle, number, number][] {
  return [
    ['nw', b.x, b.y],
    ['ne', b.x + b.width, b.y],
    ['sw', b.x, b.y + b.height],
    ['se', b.x + b.width, b.y + b.height],
  ];
}
