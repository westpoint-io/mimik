import type { Screenshot, ScreenshotBounds, Step } from '@/core/guides/types';
import { resolveTarget } from '@/core/screenshot/geometry';

const POSITION_TOLERANCE = 1;

export function stepRequiresManual(step: Step, screenshot: Screenshot | null | undefined): boolean {
  if (!step.elementMeta) return true;
  if (!screenshot?.bounds) return false;

  const target = screenshot.edits?.target;
  if (target === null) return true;
  if (!target) return false;

  const dpr = screenshot.pixelRatio || 1;
  const { bounds } = screenshot;
  const recorded = { x: bounds.x * dpr, y: bounds.y * dpr, width: bounds.width * dpr, height: bounds.height * dpr };
  const onScreenshot = resolveTarget({ ...screenshot, edits: undefined }) ?? recorded;
  const off = (a: number, b: number) => Math.abs(a - b) > POSITION_TOLERANCE;
  const movedFrom = (rect: ScreenshotBounds) =>
    off(target.x, rect.x) || off(target.y, rect.y) || off(target.width, rect.width) || off(target.height, rect.height);
  return movedFrom(recorded) && movedFrom(onScreenshot);
}
