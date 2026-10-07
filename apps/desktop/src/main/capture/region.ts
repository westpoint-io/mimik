import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, screen } from 'electron';

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_REGION = { width: 60, height: 30 };

function file(): string {
  return join(app.getPath('userData'), 'capture-region.json');
}

export function defaultRegion(): Region {
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

export function clampToDisplays(region: Region): Region {
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

export function loadRegion(): Region {
  try {
    const stored = JSON.parse(readFileSync(file(), 'utf8')) as Partial<Region>;
    const complete = (['x', 'y', 'width', 'height'] as const).every((k) => Number.isFinite(stored[k]));
    if (!complete) return defaultRegion();
    return clampToDisplays(stored as Region);
  } catch {
    return defaultRegion();
  }
}

export function saveRegion(region: Region): Region {
  const clamped = clampToDisplays(region);
  try {
    writeFileSync(file(), JSON.stringify(clamped));
  } catch {}
  return clamped;
}
