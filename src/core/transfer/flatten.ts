import type { Screenshot } from '@/core/guides/types';
import { moveAnnotation, resolveTarget } from '@/core/screenshot/geometry';
import { renderScreenshot } from '@/core/screenshot/render';
import type { ScreenshotEdits } from '@/core/screenshot/types';

export interface FlattenedScreenshot {
  meta: Omit<Screenshot, 'blob'>;
  blob: Blob;
  redacted: boolean;
}

const FORMAT = 'image/webp';
const QUALITY = 0.9;

export async function flattenScreenshot(screenshot: Screenshot): Promise<FlattenedScreenshot> {
  const crop = screenshot.edits?.viewport;
  const frame = crop ?? { x: 0, y: 0, width: screenshot.width, height: screenshot.height };
  const hadRedactions = (screenshot.edits?.annotations ?? []).some((a) => a.type === 'redact');

  const blob = await renderScreenshot(screenshot, {
    format: FORMAT,
    quality: QUALITY,
    viewport: frame,
    target: false,
    annotations: 'redactions',
  });

  const kept = (screenshot.edits?.annotations ?? []).filter((a) => a.type !== 'redact');
  const edits: ScreenshotEdits = {};
  if (screenshot.edits?.alt) edits.alt = screenshot.edits.alt;

  if (!crop) {
    if (kept.length > 0) edits.annotations = kept;
    if (screenshot.edits?.target !== undefined) edits.target = screenshot.edits.target;

    return {
      meta: {
        ...stripBlob(screenshot),
        edits: Object.keys(edits).length > 0 ? edits : undefined,
      },
      blob,
      redacted: hadRedactions,
    };
  }

  if (kept.length > 0) edits.annotations = kept.map((a) => moveAnnotation(a, -crop.x, -crop.y));

  const target = resolveTarget(screenshot);
  edits.target = target
    ? { ...target, x: target.x - crop.x, y: target.y - crop.y }
    : (screenshot.edits?.target ?? null);

  return {
    meta: {
      id: screenshot.id,
      stepId: screenshot.stepId,
      mimeType: FORMAT,
      width: Math.round(crop.width),
      height: Math.round(crop.height),
      edits,
    },
    blob,
    redacted: hadRedactions,
  };
}

function stripBlob(screenshot: Screenshot): Omit<Screenshot, 'blob' | 'edits'> {
  const { blob: _blob, edits: _edits, ...rest } = screenshot;
  return { ...rest, mimeType: FORMAT };
}
