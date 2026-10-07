import type { Rect } from '@mimik/core/rect';
import { screen } from 'electron';
import { Monitor } from 'node-screenshots';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface Capture {
  png: Buffer;
  width: number;
  height: number;
  scaleFactor: number;
  displayId: number;
}

function monitorAt(x: number, y: number): Monitor {
  const found = Monitor.fromPoint(Math.round(x), Math.round(y));
  if (found) return found;
  const all = Monitor.all();
  if (all.length === 0) throw new Error('no monitors available');
  return all[0]!;
}

export type Frame = (area: Rect) => Promise<Capture>;

export async function grabDisplay(point: { x: number; y: number }): Promise<Frame> {
  const { bounds: display, scaleFactor } = screen.getDisplayNearestPoint(point);
  const monitor = monitorAt(point.x, point.y);
  const frame = await monitor.captureImage();

  return async (area) => {
    const scale = display.width > 0 ? frame.width / display.width : scaleFactor;
    const x = clamp(Math.round((area.x - display.x) * scale), 0, Math.max(0, frame.width - 1));
    const y = clamp(Math.round((area.y - display.y) * scale), 0, Math.max(0, frame.height - 1));
    const width = clamp(Math.round(area.width * scale), 1, frame.width - x);
    const height = clamp(Math.round(area.height * scale), 1, frame.height - y);

    const cropped = width === frame.width && height === frame.height ? frame : await frame.crop(x, y, width, height);
    const png = await cropped.toPng(true);
    if (png.length === 0 || cropped.width === 0 || cropped.height === 0) {
      throw new Error(
        `capture produced an empty image: frame ${frame.width}x${frame.height}, area ${area.width}x${area.height} at ${scale}x`,
      );
    }

    return {
      png,
      width: cropped.width,
      height: cropped.height,
      scaleFactor: area.width > 0 ? cropped.width / area.width : 1,
      displayId: monitor.id(),
    };
  };
}

async function captureDisplay(displayId: number): Promise<Capture> {
  const display = screen.getAllDisplays().find((d) => d.id === displayId);
  if (!display) throw new Error(`no display with id ${displayId}`);
  const frame = await grabDisplay({
    x: display.bounds.x + display.bounds.width / 2,
    y: display.bounds.y + display.bounds.height / 2,
  });
  return frame(display.bounds);
}

export async function captureCursorDisplay(): Promise<Capture> {
  const point = screen.getCursorScreenPoint();
  return captureDisplay(screen.getDisplayNearestPoint(point).id);
}
