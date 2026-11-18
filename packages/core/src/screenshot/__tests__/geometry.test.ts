import { describe, expect, it } from 'vitest';
import type { Screenshot } from '@/core/guides/types';
import {
  annotationBounds,
  cropTo,
  hitTest,
  isOffImage,
  keepInside,
  moveAnnotation,
  panBy,
  resizeAnnotation,
  resolveTarget,
  resolveViewport,
  zoomBy,
} from '@/core/screenshot/geometry';
import type { Annotation } from '@/core/screenshot/types';

function makeScreenshot(overrides: Partial<Screenshot> = {}): Screenshot {
  return {
    id: 'ss-1',
    stepId: 'step-1',
    blob: new Blob(['x']),
    mimeType: 'image/png',
    width: 1000,
    height: 800,
    ...overrides,
  };
}

describe('resolveViewport', () => {
  it('returns the whole image when there are no bounds and no edits', () => {
    expect(resolveViewport(makeScreenshot())).toEqual({ x: 0, y: 0, width: 1000, height: 800 });
  });

  it('prefers an explicit viewport over the bounds default', () => {
    const s = makeScreenshot({
      bounds: { x: 10, y: 10, width: 50, height: 50 },
      edits: { viewport: { x: 100, y: 200, width: 300, height: 240 } },
    });
    expect(resolveViewport(s)).toEqual({ x: 100, y: 200, width: 300, height: 240 });
  });

  it('pads around bounds and keeps the image aspect ratio', () => {
    const s = makeScreenshot({ bounds: { x: 400, y: 300, width: 200, height: 100 }, pixelRatio: 1 });
    const v = resolveViewport(s);
    expect(v.width / v.height).toBeCloseTo(1000 / 800, 5);
    expect(v.width).toBeGreaterThan(200);
  });

  it('clamps the viewport inside the image', () => {
    const s = makeScreenshot({ bounds: { x: 0, y: 0, width: 40, height: 40 }, pixelRatio: 1 });
    const v = resolveViewport(s);
    expect(v.x).toBeGreaterThanOrEqual(0);
    expect(v.y).toBeGreaterThanOrEqual(0);
    expect(v.x + v.width).toBeLessThanOrEqual(1000);
    expect(v.y + v.height).toBeLessThanOrEqual(800);
  });

  it('never exceeds the image size', () => {
    const s = makeScreenshot({ bounds: { x: 0, y: 0, width: 990, height: 790 }, pixelRatio: 1 });
    const v = resolveViewport(s);
    expect(v.width).toBeLessThanOrEqual(1000);
    expect(v.height).toBeLessThanOrEqual(800);
  });

  it('shows the whole page rather than the top-left corner when the element vanished before measuring', () => {
    const s = makeScreenshot({ bounds: { x: 0, y: 0, width: 0, height: 0 }, pixelRatio: 2 });
    expect(resolveViewport(s)).toEqual({ x: 0, y: 0, width: 1000, height: 800 });
  });
});

describe('resolveTarget', () => {
  it('derives the target from bounds at the captured pixel ratio', () => {
    const s = makeScreenshot({ bounds: { x: 50, y: 60, width: 100, height: 20 }, pixelRatio: 2 });
    expect(resolveTarget(s)).toMatchObject({ x: 100, y: 120, width: 200, height: 40 });
  });

  it('prefers an explicit target from the editor', () => {
    const s = makeScreenshot({
      bounds: { x: 50, y: 60, width: 100, height: 20 },
      edits: { target: { x: 1, y: 2, width: 3, height: 4, border: 'dashed', color: '#fff' } },
    });
    expect(resolveTarget(s)).toMatchObject({ x: 1, y: 2, width: 3, height: 4 });
  });

  it('respects a target the user deliberately removed', () => {
    expect(
      resolveTarget(makeScreenshot({ bounds: { x: 5, y: 5, width: 9, height: 9 }, edits: { target: null } })),
    ).toBe(null);
  });

  it('puts a target moved off the picture back where it was recorded', () => {
    const s = makeScreenshot({
      bounds: { x: 300, y: 200, width: 50, height: 20 },
      pixelRatio: 2,
      edits: { target: { x: 1700, y: 400, width: 100, height: 40, border: 'solid', color: '#F43F5E' } },
    });
    expect(resolveTarget(s)).toEqual({ x: 600, y: 400, width: 100, height: 40, border: 'solid', color: '#F43F5E' });
  });

  it('moves a target off the picture to the nearest edge when nothing was recorded', () => {
    const s = makeScreenshot({
      edits: { target: { x: 1700, y: 400, width: 100, height: 40, border: 'dashed', color: '#fff' } },
    });
    expect(resolveTarget(s)).toMatchObject({ x: 900, y: 400, width: 100, height: 40 });
  });

  it('moves a target off the picture to the nearest edge when the recorded position is off it too', () => {
    const s = makeScreenshot({
      bounds: { x: 2000, y: 10, width: 50, height: 20 },
      edits: { target: { x: -300, y: 400, width: 100, height: 40, border: 'dashed', color: '#fff' } },
    });
    expect(resolveTarget(s)).toMatchObject({ x: 0, y: 400, width: 100, height: 40 });
  });

  it('trims a recorded target that runs past the edge to the part on the picture', () => {
    const s = makeScreenshot({ bounds: { x: 980, y: -5, width: 50, height: 20 } });
    expect(resolveTarget(s)).toMatchObject({ x: 980, y: 0, width: 20, height: 15 });
  });

  it('keeps the place and size the user chose when only part of their target runs past the edge', () => {
    const s = makeScreenshot({
      bounds: { x: 100, y: 100, width: 20, height: 20 },
      edits: { target: { x: 950, y: 10, width: 100, height: 20, border: 'dashed', color: '#fff' } },
    });
    expect(resolveTarget(s)).toMatchObject({ x: 950, y: 10, width: 50, height: 20 });
  });

  it('reports no target rather than one pinned to the origin when the element vanished before measuring', () => {
    const zeroed = { x: 0, y: 0, width: 0, height: 0, border: 'dashed' as const, color: '#4F46E5' };
    expect(resolveTarget(makeScreenshot({ edits: { target: zeroed } }))).toBe(null);
    expect(resolveTarget(makeScreenshot({ bounds: { x: 0, y: 0, width: 0, height: 0 }, pixelRatio: 2 }))).toBe(null);
  });
});

const IMG = { width: 1000, height: 800 };
const FULL = { x: 0, y: 0, width: 1000, height: 800 };

describe('zoomBy', () => {
  it('shrinks the viewport around its centre when zooming in', () => {
    const v = zoomBy(FULL, 2, IMG);
    expect(v.width).toBe(500);
    expect(v.height).toBe(400);
    expect(v.x + v.width / 2).toBeCloseTo(500, 5);
    expect(v.y + v.height / 2).toBeCloseTo(400, 5);
  });

  it('never grows past the image', () => {
    expect(zoomBy(FULL, 0.5, IMG)).toEqual(FULL);
  });

  it('stays inside the image when zooming out from a corner', () => {
    const v = zoomBy({ x: 0, y: 0, width: 200, height: 160 }, 0.5, IMG);
    expect(v.x).toBeGreaterThanOrEqual(0);
    expect(v.x + v.width).toBeLessThanOrEqual(1000);
  });

  it('clamps to a minimum viewport size', () => {
    let v = FULL;
    for (let i = 0; i < 20; i++) v = zoomBy(v, 2, IMG);
    expect(v.width).toBeGreaterThan(0);
    expect(v.height).toBeGreaterThan(0);
  });
});

describe('panBy', () => {
  it('translates the viewport', () => {
    const v = panBy({ x: 100, y: 100, width: 500, height: 400 }, 50, -20, IMG);
    expect(v).toEqual({ x: 150, y: 80, width: 500, height: 400 });
  });

  it('clamps at the image edges instead of scrolling past them', () => {
    const v = panBy({ x: 0, y: 0, width: 500, height: 400 }, -100, -100, IMG);
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });

  it('clamps at the far edges', () => {
    const v = panBy({ x: 500, y: 400, width: 500, height: 400 }, 100, 100, IMG);
    expect(v.x).toBe(500);
    expect(v.y).toBe(400);
  });
});

describe('cropTo', () => {
  it('accepts a free aspect ratio', () => {
    expect(cropTo({ x: 10, y: 20, width: 100, height: 900 }, IMG)).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 780,
    });
  });

  it('normalises a rect dragged up and to the left', () => {
    expect(cropTo({ x: 300, y: 200, width: -100, height: -50 }, IMG)).toEqual({
      x: 200,
      y: 150,
      width: 100,
      height: 50,
    });
  });
});

const box: Annotation = { id: 'a', type: 'box', x: 100, y: 100, w: 200, h: 100, color: '#4F46E5' };
const arrow: Annotation = { id: 'b', type: 'arrow', x1: 10, y1: 10, x2: 110, y2: 60, color: '#4F46E5' };
const stroke: Annotation = { id: 'c', type: 'freehand', points: [0, 0, 50, 80, 20, 40], color: '#4F46E5' };

describe('annotationBounds', () => {
  it('returns the rect for a box', () => {
    expect(annotationBounds(box)).toEqual({ x: 100, y: 100, width: 200, height: 100 });
  });

  it('returns the span of an arrow regardless of direction', () => {
    expect(annotationBounds({ ...arrow, x1: 110, y1: 60, x2: 10, y2: 10 })).toEqual({
      x: 10,
      y: 10,
      width: 100,
      height: 50,
    });
  });

  it('returns the bounding box of a freehand stroke', () => {
    expect(annotationBounds(stroke)).toEqual({ x: 0, y: 0, width: 50, height: 80 });
  });
});

describe('hitTest', () => {
  it('returns the topmost annotation under the point', () => {
    const under: Annotation = { ...box, id: 'under' };
    const over: Annotation = { ...box, id: 'over' };
    expect(hitTest([under, over], 150, 150)?.id).toBe('over');
  });

  it('returns null when nothing is under the point', () => {
    expect(hitTest([box], 5, 5)).toBeNull();
  });

  it('hits a thin arrow via its padded bounds', () => {
    expect(hitTest([arrow], 60, 35)?.id).toBe('b');
  });
});

describe('moveAnnotation', () => {
  it('translates a box', () => {
    expect(moveAnnotation(box, 10, -5)).toMatchObject({ x: 110, y: 95, w: 200, h: 100 });
  });

  it('translates both ends of an arrow', () => {
    expect(moveAnnotation(arrow, 5, 5)).toMatchObject({ x1: 15, y1: 15, x2: 115, y2: 65 });
  });

  it('translates every point of a freehand stroke', () => {
    expect(moveAnnotation(stroke, 10, 10)).toMatchObject({ points: [10, 10, 60, 90, 30, 50] });
  });
});

describe('resizeAnnotation', () => {
  it('resizes a box from the south-east handle', () => {
    expect(resizeAnnotation(box, 'se', 50, 20)).toMatchObject({ x: 100, y: 100, w: 250, h: 120 });
  });

  it('resizes a box from the north-west handle by moving its origin', () => {
    expect(resizeAnnotation(box, 'nw', 20, 10)).toMatchObject({ x: 120, y: 110, w: 180, h: 90 });
  });

  it('scales a freehand stroke about the anchored corner', () => {
    expect(resizeAnnotation(stroke, 'se', 10, 10)).toMatchObject({ points: [0, 0, 60, 90, 24, 45] });
  });

  it('scales an arrow about the anchored corner', () => {
    expect(resizeAnnotation(arrow, 'se', 20, 0)).toMatchObject({ x1: 10, y1: 10, x2: 130, y2: 60 });
  });
});

describe('viewport padding on a large frame', () => {
  const shot = (imgW: number, imgH: number, w: number, h: number) =>
    ({
      id: 's',
      stepId: 't',
      blob: new Blob(),
      mimeType: 'image/png',
      width: imgW,
      height: imgH,
      pixelRatio: 1,
      bounds: { x: imgW / 2, y: imgH / 2, width: w, height: h },
    }) as Screenshot;

  it('frames a small target tightly instead of a third of the screen', () => {
    const viewport = resolveViewport(shot(2560, 1440, 40, 40));
    expect(viewport.width).toBeLessThan(2560 * 0.15);
  });

  it('leaves a browser-sized target as it was', () => {
    const viewport = resolveViewport(shot(1440, 900, 120, 40));
    expect(viewport.width).toBeCloseTo(552, 0);
  });
});

describe('keepInside', () => {
  const img = { width: 1600, height: 1000 };
  const target: Annotation = {
    id: 't',
    type: 'target',
    x: 1700,
    y: 700,
    w: 220,
    h: 70,
    color: '#4F46E5',
    border: 'dashed',
  };

  it('leaves an annotation that is already on the image alone', () => {
    const box: Annotation = { id: 'b', type: 'box', x: 100, y: 100, w: 50, h: 50, color: '#000' };
    expect(keepInside(box, img)).toEqual(box);
  });

  it('pulls a target saved past the right edge back onto the image', () => {
    expect(keepInside(target, img)).toMatchObject({ x: 1380, y: 700, w: 220, h: 70 });
  });

  it('pulls a target above and left of the image back to the corner', () => {
    expect(keepInside({ ...target, x: -500, y: -40 }, img)).toMatchObject({ x: 0, y: 0, w: 220, h: 70 });
  });

  it('shrinks a box larger than the image to the image', () => {
    const box: Annotation = { id: 'b', type: 'box', x: -10, y: 5, w: 2000, h: 1200, color: '#000' };
    expect(keepInside(box, img)).toMatchObject({ x: 0, y: 0, w: 1600, h: 1000 });
  });

  it('moves an arrow back without bending it', () => {
    const arrow: Annotation = { id: 'a', type: 'arrow', x1: 1550, y1: 100, x2: 1650, y2: 200, color: '#000' };
    expect(keepInside(arrow, img)).toMatchObject({ x1: 1500, y1: 100, x2: 1600, y2: 200 });
  });

  it('keeps both ends of an arrow longer than the image on it', () => {
    const arrow: Annotation = { id: 'a', type: 'arrow', x1: -100, y1: 10, x2: 1900, y2: 20, color: '#000' };
    expect(keepInside(arrow, img)).toMatchObject({ x1: 0, y1: 10, x2: 1600, y2: 20 });
  });

  it('moves a freehand stroke back onto the image', () => {
    const stroke: Annotation = { id: 'f', type: 'freehand', points: [10, 990, 20, 1040], color: '#000' };
    expect(keepInside(stroke, img)).toMatchObject({ points: [10, 950, 20, 1000] });
  });

  it('moves text down until its top is on the image', () => {
    const text: Annotation = { id: 'x', type: 'text', x: 10, y: 5, text: 'Hi', color: '#000', size: 32, w: 40, h: 45 };
    const kept = keepInside(text, img);
    expect(annotationBounds(kept).y).toBe(0);
  });
});

describe('isOffImage', () => {
  const img = { width: 1600, height: 1000 };

  it('counts a shape with any part on the picture as on it', () => {
    expect(isOffImage({ id: 'b', type: 'box', x: 1590, y: 10, w: 50, h: 50, color: '#000' }, img)).toBe(false);
    expect(isOffImage({ id: 'a', type: 'arrow', x1: 10, y1: 20, x2: 300, y2: 20, color: '#000' }, img)).toBe(false);
  });

  it('flags a shape with nothing left on the picture', () => {
    expect(isOffImage({ id: 'b', type: 'box', x: 1700, y: 10, w: 50, h: 50, color: '#000' }, img)).toBe(true);
    expect(isOffImage({ id: 'b', type: 'box', x: 10, y: -90, w: 50, h: 50, color: '#000' }, img)).toBe(true);
  });
});
