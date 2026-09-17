import { describe, expect, it, vi } from 'vitest';
import type { Screenshot } from '@/core/guides/types';
import type { Annotation } from '@/core/screenshot/types';

const renderScreenshot = vi.hoisted(() => vi.fn(async () => new Blob(['rendered'], { type: 'image/webp' })));
vi.mock('@/core/screenshot/render', () => ({ renderScreenshot }));

import { flattenScreenshot } from '../flatten';

function makeScreenshot(overrides: Partial<Screenshot> = {}): Screenshot {
  return {
    id: 'ss-1',
    stepId: 'step-1',
    blob: new Blob(['raw'], { type: 'image/png' }),
    mimeType: 'image/png',
    width: 1000,
    height: 800,
    ...overrides,
  };
}

const redaction: Annotation = { id: 'r1', type: 'redact', x: 100, y: 120, w: 60, h: 20, style: 'blur' };
const box: Annotation = { id: 'b1', type: 'box', x: 200, y: 240, w: 80, h: 40, color: '#000' };

describe('flattenScreenshot', () => {
  it('bakes redactions into the pixels and drops them from the edits', async () => {
    const { meta, redacted } = await flattenScreenshot(makeScreenshot({ edits: { annotations: [redaction, box] } }));

    expect(renderScreenshot).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ annotations: 'redactions' }),
    );
    expect(meta.edits?.annotations).toEqual([box]);
    expect(redacted).toBe(true);
  });

  it('returns the rendered blob, never the raw capture', async () => {
    const screenshot = makeScreenshot({ edits: { annotations: [redaction] } });
    const { blob } = await flattenScreenshot(screenshot);

    expect(await blob.text()).toBe('rendered');
    expect(blob).not.toBe(screenshot.blob);
    expect(await blob.text()).not.toContain('raw');
  });

  it('reports a crop alone as non-redacted, so the recipient is not told otherwise', async () => {
    const { redacted } = await flattenScreenshot(
      makeScreenshot({ edits: { viewport: { x: 10, y: 10, width: 100, height: 100 }, annotations: [box] } }),
    );
    expect(redacted).toBe(false);
  });

  it('renders the full frame when there is no explicit crop, so the auto-zoom still travels as data', async () => {
    const screenshot = makeScreenshot({ bounds: { x: 10, y: 20, width: 30, height: 40 }, pixelRatio: 2 });
    const { meta } = await flattenScreenshot(screenshot);

    expect(renderScreenshot).toHaveBeenCalledWith(
      screenshot,
      expect.objectContaining({ viewport: { x: 0, y: 0, width: 1000, height: 800 } }),
    );
    expect(meta.bounds).toEqual({ x: 10, y: 20, width: 30, height: 40 });
    expect(meta.width).toBe(1000);
  });

  it('reports a clean screenshot as non-redacted', async () => {
    const { redacted } = await flattenScreenshot(makeScreenshot({ edits: { annotations: [box] } }));
    expect(redacted).toBe(false);
  });

  describe('with an explicit crop', () => {
    const crop = { x: 100, y: 50, width: 400, height: 300 };

    it('bakes the crop and rebases the annotations that survive it', async () => {
      const { meta, redacted } = await flattenScreenshot(
        makeScreenshot({ edits: { viewport: crop, annotations: [box, redaction] } }),
      );

      expect(renderScreenshot).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ viewport: crop }));
      expect(meta.width).toBe(400);
      expect(meta.height).toBe(300);
      expect(meta.edits?.viewport).toBeUndefined();
      expect(meta.edits?.annotations).toEqual([{ ...box, x: 100, y: 190 }]);
      expect(redacted).toBe(true);
    });

    it('resolves the target once and drops the pre-crop bounds it came from', async () => {
      const { meta } = await flattenScreenshot(
        makeScreenshot({
          bounds: { x: 150, y: 100, width: 50, height: 25 },
          pixelRatio: 2,
          edits: { viewport: crop },
        }),
      );

      expect(meta.edits?.target).toMatchObject({ x: 200, y: 150, width: 100, height: 50 });
      expect(meta.bounds).toBeUndefined();
      expect(meta.pixelRatio).toBeUndefined();
    });

    it('keeps the alt text', async () => {
      const { meta } = await flattenScreenshot(makeScreenshot({ edits: { viewport: crop, alt: 'the save button' } }));
      expect(meta.edits?.alt).toBe('the save button');
    });
  });
});
