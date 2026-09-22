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

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function monitorAt(x: number, y: number): Monitor {
  const found = Monitor.fromPoint(Math.round(x), Math.round(y));
  if (found) return found;
  const all = Monitor.all();
  if (all.length === 0) throw new Error('no monitors available');
  return all[0];
}

export async function captureArea(area: Rect): Promise<Capture> {
  const display = screen.getDisplayMatching(area);
  const monitor = monitorAt(area.x + area.width / 2, area.y + area.height / 2);
  const frame = await monitor.captureImage();

  const scale = display.bounds.width > 0 ? frame.width / display.bounds.width : display.scaleFactor;
  const x = clamp(Math.round((area.x - display.bounds.x) * scale), 0, Math.max(0, frame.width - 1));
  const y = clamp(Math.round((area.y - display.bounds.y) * scale), 0, Math.max(0, frame.height - 1));
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
}

export async function captureDisplay(displayId: number): Promise<Capture> {
  const display = screen.getAllDisplays().find((d) => d.id === displayId);
  if (!display) throw new Error(`no display with id ${displayId}`);
  return captureArea(display.bounds);
}

export async function captureCursorDisplay(): Promise<Capture> {
  const point = screen.getCursorScreenPoint();
  return captureDisplay(screen.getDisplayNearestPoint(point).id);
}
