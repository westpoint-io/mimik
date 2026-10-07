import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Rect } from '@mimik/core/rect';
import { app, screen } from 'electron';

const MIN_REGION = { width: 60, height: 30 };

function file(): string {
  return join(app.getPath('userData'), 'capture-region.json');
}

export function defaultRegion(): Rect {
  const { workArea } = screen.getPrimaryDisplay();
  const width = Math.round(workArea.width * 0.6);
  const height = Math.round(workArea.height * 0.6);
  return {
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    width,
    height,
  };
}

export function clampToDisplays(region: Rect): Rect {
  const { workArea } = screen.getDisplayMatching(region);
  const width = Math.min(Math.max(region.width, MIN_REGION.width), workArea.width);
  const height = Math.min(Math.max(region.height, MIN_REGION.height), workArea.height);
  return {
    x: Math.min(Math.max(region.x, workArea.x), workArea.x + workArea.width - width),
    y: Math.min(Math.max(region.y, workArea.y), workArea.y + workArea.height - height),
    width,
    height,
  };
}

export function loadRegion(): Rect {
  try {
    const stored = JSON.parse(readFileSync(file(), 'utf8')) as Partial<Rect>;
    const complete = (['x', 'y', 'width', 'height'] as const).every((k) => Number.isFinite(stored[k]));
    if (!complete) return defaultRegion();
    return clampToDisplays(stored as Rect);
  } catch {
    return defaultRegion();
  }
}

export function saveRegion(region: Rect): Rect {
  const clamped = clampToDisplays(region);
  try {
    writeFileSync(file(), JSON.stringify(clamped));
  } catch {}
  return clamped;
}
