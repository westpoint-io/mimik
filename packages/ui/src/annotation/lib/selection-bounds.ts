import type { ScreenshotBounds } from '@mimik/core/guides/types';
import { annotationBounds } from '@mimik/core/screenshot/geometry';
import type { Annotation } from '@mimik/core/screenshot/types';

const SELECTION_GAP = 6;

export function selectionBounds(a: Annotation, scale: number): ScreenshotBounds {
  const inset = SELECTION_GAP * scale;
  const b = annotationBounds(a);
  return { x: b.x - inset, y: b.y - inset, width: b.width + inset * 2, height: b.height + inset * 2 };
}
