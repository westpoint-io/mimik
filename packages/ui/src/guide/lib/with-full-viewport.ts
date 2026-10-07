import type { Screenshot } from '@mimik/core/guides/types';

export function withFullViewport(screenshot: Screenshot): Screenshot {
  return {
    ...screenshot,
    edits: { ...screenshot.edits, viewport: { x: 0, y: 0, width: screenshot.width, height: screenshot.height } },
  };
}
