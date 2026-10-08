import type { Rect } from '@mimik/core/rect';

const MIN = { width: 60, height: 30 };

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface Point {
  x: number;
  y: number;
}

function normalise(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.max(Math.abs(a.x - b.x), MIN.width),
    height: Math.max(Math.abs(a.y - b.y), MIN.height),
  };
}

export function dragRegion(
  from: Rect | null,
  handle: Handle | null,
  moving: boolean,
  start: Point,
  point: Point,
): Rect {
  if (handle && from) {
    const left = handle.includes('w') ? point.x : from.x;
    const top = handle.includes('n') ? point.y : from.y;
    const right = handle.includes('e') ? point.x : from.x + from.width;
    const bottom = handle.includes('s') ? point.y : from.y + from.height;
    return normalise({ x: left, y: top }, { x: right, y: bottom });
  }
  if (moving && from) return { ...from, x: from.x + (point.x - start.x), y: from.y + (point.y - start.y) };
  return normalise(start, point);
}
