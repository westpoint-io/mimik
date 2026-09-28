import type { Screenshot } from '@mimik/core/guides/types';
import type { ScreenshotEdits } from '@mimik/core/screenshot/types';

export function renderKey(screenshot: Screenshot, edits: ScreenshotEdits | undefined): string | null {
  if (!screenshot.blob) return null;
  return `${screenshot.id}:${screenshot.blob.size}:${JSON.stringify(edits?.annotations ?? null)}:${JSON.stringify(edits?.target ?? null)}`;
}
