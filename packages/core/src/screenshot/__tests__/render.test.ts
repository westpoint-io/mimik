import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Screenshot } from '@/core/guides/types';
import type { Annotation } from '@/core/screenshot/types';
import { DEFAULT_TARGET_COLOR } from '@/core/screenshot/types';

const drawAnnotation = vi.hoisted(() => vi.fn());
vi.mock('@/core/screenshot/draw', () => ({ drawAnnotation }));

const { imageDimensions, renderScreenshot } = await import('@/core/screenshot/render');

interface Call {
  m: string;
  a: unknown[];
}

let calls: Call[] = [];
let closed = 0;
let canvases: FakeCanvas[] = [];
let convertArgs: unknown[] = [];

class FakeCanvas {
  ctx: Record<string, unknown>;

  constructor(
    public width: number,
    public height: number,
  ) {
    canvases.push(this);
    const record =
      (m: string) =>
      (...a: unknown[]) => {
        calls.push({ m, a });
      };
    this.ctx = {
      canvas: this,
      drawImage: record('drawImage'),
      translate: record('translate'),
      save: record('save'),
      restore: record('restore'),
    };
  }

  getContext() {
    return this.ctx;
  }

  convertToBlob(opts: unknown) {
    convertArgs.push(opts);
    return Promise.resolve(new Blob(['out']));
  }
}

function makeScreenshot(overrides: Partial<Screenshot> = {}): Screenshot {
  return {
    id: 'ss-1',
    stepId: 'step-1',
    blob: new Blob(['raw']),
    mimeType: 'image/png',
    width: 1200,
    height: 900,
    ...overrides,
  };
}

beforeEach(() => {
  calls = [];
  canvases = [];
  convertArgs = [];
  closed = 0;
  drawAnnotation.mockClear();
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({
      width: 1200,
      height: 900,
      close: () => {
        closed += 1;
      },
    })),
  );
  vi.stubGlobal('OffscreenCanvas', FakeCanvas);
});

describe('imageDimensions', () => {
  it('reads the bitmap size and releases it', async () => {
    await expect(imageDimensions(new Blob(['x']))).resolves.toEqual({ width: 1200, height: 900 });
    expect(closed).toBe(1);
  });
});

describe('renderScreenshot', () => {
  it('sizes the canvas to the full image when there is no crop', async () => {
    await renderScreenshot(makeScreenshot());

    expect(canvases[0].width).toBe(1200);
    expect(canvases[0].height).toBe(900);
  });

  it('rounds a fractional viewport to whole pixels', async () => {
    const s = makeScreenshot({ edits: { viewport: { x: 10, y: 20, width: 640.6, height: 480.2 } } });
    await renderScreenshot(s);

    expect(canvases[0].width).toBe(641);
    expect(canvases[0].height).toBe(480);
  });

  it('maps the viewport rectangle onto the whole canvas', async () => {
    const s = makeScreenshot({ edits: { viewport: { x: 100, y: 50, width: 600, height: 400 } } });
    await renderScreenshot(s);

    const [, sx, sy, sw, sh, dx, dy, dw, dh] = calls.find((c) => c.m === 'drawImage')?.a as number[];
    expect([sx, sy, sw, sh]).toEqual([100, 50, 600, 400]);
    expect([dx, dy, dw, dh]).toEqual([0, 0, 600, 400]);
  });

  it('shifts the origin so annotations can use full image coordinates', async () => {
    const s = makeScreenshot({ edits: { viewport: { x: 100, y: 50, width: 600, height: 400 } } });
    await renderScreenshot(s);

    expect(calls.find((c) => c.m === 'translate')?.a).toEqual([-100, -50]);
  });

  it('releases the bitmap after drawing it', async () => {
    await renderScreenshot(makeScreenshot());

    expect(closed).toBe(1);
  });

  it('defaults to webp at 0.85', async () => {
    await renderScreenshot(makeScreenshot());

    expect(convertArgs[0]).toEqual({ type: 'image/webp', quality: 0.85 });
  });

  it('honours an explicit format and quality', async () => {
    await renderScreenshot(makeScreenshot(), { format: 'image/jpeg', quality: 0.5 });

    expect(convertArgs[0]).toEqual({ type: 'image/jpeg', quality: 0.5 });
  });

  it('returns the encoded blob', async () => {
    await expect(renderScreenshot(makeScreenshot())).resolves.toBeInstanceOf(Blob);
  });
});

describe('renderScreenshot click target', () => {
  const bounded = () => makeScreenshot({ bounds: { x: 30, y: 40, width: 120, height: 60 }, pixelRatio: 2 });

  it('outlines the click target derived from bounds and pixel ratio', async () => {
    await renderScreenshot(bounded());

    expect(drawAnnotation).toHaveBeenCalledTimes(1);
    expect(drawAnnotation.mock.calls[0][1]).toEqual({
      id: 'target',
      type: 'target',
      x: 60,
      y: 80,
      w: 240,
      h: 120,
      color: DEFAULT_TARGET_COLOR,
      border: 'dashed',
    });
  });

  it('skips the outline when the caller opts out', async () => {
    await renderScreenshot(bounded(), { target: false });

    expect(drawAnnotation).not.toHaveBeenCalled();
  });

  it('draws no outline when the screenshot has no bounds', async () => {
    await renderScreenshot(makeScreenshot());

    expect(drawAnnotation).not.toHaveBeenCalled();
  });

  it('prefers an explicit edited target over the captured bounds', async () => {
    const s = makeScreenshot({
      bounds: { x: 30, y: 40, width: 120, height: 60 },
      edits: { target: { x: 5, y: 6, width: 7, height: 8, border: 'solid', color: '#F43F5E' } },
    });
    await renderScreenshot(s);

    expect(drawAnnotation.mock.calls[0][1]).toMatchObject({ x: 5, y: 6, w: 7, h: 8, border: 'solid' });
  });

  it('honours an edited target that was cleared', async () => {
    const s = makeScreenshot({ bounds: { x: 30, y: 40, width: 120, height: 60 }, edits: { target: null } });
    await renderScreenshot(s);

    expect(drawAnnotation).not.toHaveBeenCalled();
  });
});

describe('renderScreenshot annotations', () => {
  const annotations: Annotation[] = [
    { id: 'a1', type: 'box', x: 1, y: 2, w: 3, h: 4, color: '#000' },
    { id: 'a2', type: 'redact', x: 5, y: 6, w: 7, h: 8, style: 'blur' },
  ];

  it('draws every annotation in order after the target', async () => {
    const s = makeScreenshot({
      bounds: { x: 10, y: 10, width: 20, height: 20 },
      edits: { annotations },
    });
    await renderScreenshot(s);

    const ids = drawAnnotation.mock.calls.map((c) => (c[1] as Annotation).id);
    expect(ids).toEqual(['target', 'a1', 'a2']);
  });

  it('passes the viewport origin so a redaction lands on the right pixels', async () => {
    const s = makeScreenshot({
      edits: { viewport: { x: 100, y: 50, width: 600, height: 400 }, annotations },
    });
    await renderScreenshot(s);

    for (const call of drawAnnotation.mock.calls) {
      expect([call[2], call[3]]).toEqual([100, 50]);
    }
  });

  it('draws nothing extra when there are no annotations', async () => {
    await renderScreenshot(makeScreenshot({ edits: { annotations: [] } }));

    expect(drawAnnotation).not.toHaveBeenCalled();
  });

  describe("annotations: 'redactions'", () => {
    it('draws the redactions and leaves every other annotation out', async () => {
      const s = makeScreenshot({
        bounds: { x: 10, y: 10, width: 20, height: 20 },
        edits: { annotations },
      });
      await renderScreenshot(s, { annotations: 'redactions', target: false });

      const ids = drawAnnotation.mock.calls.map((c) => (c[1] as Annotation).id);
      expect(ids).toEqual(['a2']);
    });

    it('still draws everything under the default', async () => {
      await renderScreenshot(makeScreenshot({ edits: { annotations } }), { target: false });

      const ids = drawAnnotation.mock.calls.map((c) => (c[1] as Annotation).id);
      expect(ids).toEqual(['a1', 'a2']);
    });

    it('draws nothing when the screenshot has no redactions to bake', async () => {
      const box = annotations[0];
      await renderScreenshot(makeScreenshot({ edits: { annotations: [box] } }), {
        annotations: 'redactions',
        target: false,
      });

      expect(drawAnnotation).not.toHaveBeenCalled();
    });
  });
});
