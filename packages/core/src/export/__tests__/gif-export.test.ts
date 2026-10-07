import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_EXPORT_OPTIONS } from '@/core/export/options';
import type { Guide, Screenshot, Step } from '@/core/guides/types';

const rec = vi.hoisted(() => ({
  written: [] as { width: number; height: number; options: Record<string, unknown> }[],
  finished: 0,
}));

const branding = vi.hoisted(() => ({
  value: {
    logo: null as null | { dataUrl: string; width: number; height: number },
    footer: '',
    attribution: false,
    accent: '#4F46E5',
    custom: false,
  },
}));

function fakeCtx(width: number, height: number) {
  const store: Record<string, unknown> = { filter: 'none' };
  const base: Record<string, unknown> = {
    canvas: { width, height },
    measureText: (t: unknown) => ({ width: String(t).length * 8 }),
    getImageData: () => ({ data: new Uint8ClampedArray(width * height * 4) }),
  };
  return new Proxy(base, {
    has: () => true,
    get(target, key) {
      const k = String(key);
      if (k in target) return target[k];
      if (k in store) return store[k];
      return () => undefined;
    },
    set(_target, key, value) {
      store[String(key)] = value;
      return true;
    },
  }) as unknown as OffscreenCanvasRenderingContext2D;
}

vi.mock('gifenc', () => ({
  quantize: vi.fn(() => [[0, 0, 0]]),
  applyPalette: vi.fn(() => new Uint8Array(4)),
  GIFEncoder: () => ({
    writeFrame: (_i: Uint8Array, width: number, height: number, options: Record<string, unknown> = {}) => {
      rec.written.push({ width, height, options });
    },
    finish: () => {
      rec.finished += 1;
    },
    bytes: () => new Uint8Array([0x47, 0x49, 0x46]),
  }),
}));

vi.mock('@/core/screenshot/render', () => ({
  renderScreenshot: vi.fn(async () => new Blob(['webp'])),
}));

vi.mock('@/core/export/branding', async () => {
  const actual = await vi.importActual<typeof import('@/core/export/branding')>('@/core/export/branding');
  return { ...actual, loadBranding: vi.fn(async () => branding.value) };
});

const { exportGuideAsGif, gifDelayMs } = await import('@/core/export/gif-export');
const { GIF_SPECS } = await import('@/core/export/options');
const SPEC = GIF_SPECS.medium;
const { totalStepFrames } = await import('@/core/export/video-export');

const guide: Guide = {
  id: 'g1',
  title: 'Reset your password',
  createdAt: new Date('2026-03-04T10:00:00Z').getTime(),
  updatedAt: new Date('2026-03-04T10:00:00Z').getTime(),
  stepIds: [],
  starred: false,
  deletedAt: null,
};

function makeStep(i: number, overrides: Partial<Step> = {}): Step {
  return {
    id: `s${i}`,
    guideId: 'g1',
    index: i,
    description: `Click the button labelled ${i}`,
    action: 'click',
    url: 'https://example.com/settings',
    timestamp: guide.createdAt,
    screenshotId: `shot-s${i}`,
    ...overrides,
  };
}

function makeShot(stepId: string): Screenshot {
  return {
    id: `shot-${stepId}`,
    stepId,
    blob: new Blob(['raw']),
    mimeType: 'image/webp',
    width: 1280,
    height: 720,
    bounds: { x: 100, y: 200, width: 120, height: 40 },
    pixelRatio: 1,
  };
}

function shotsFor(steps: Step[]): Map<string, Screenshot> {
  return new Map(steps.filter((s) => !s.blockType).map((s) => [s.id, makeShot(s.id)]));
}

const opts = (o = {}) => ({ ...DEFAULT_EXPORT_OPTIONS, cover: false, ...o });

beforeEach(() => {
  rec.written = [];
  rec.finished = 0;
  branding.value = { logo: null, footer: '', attribution: false, accent: '#4F46E5', custom: false };

  class FakeOffscreen {
    constructor(
      public width: number,
      public height: number,
    ) {}
    getContext() {
      return fakeCtx(this.width, this.height);
    }
  }
  vi.stubGlobal('OffscreenCanvas', FakeOffscreen);
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 1280, height: 720, close: () => undefined })),
  );
});

describe('gifDelayMs', () => {
  it('rounds a frame duration to GIF centisecond granularity', () => {
    expect(gifDelayMs(1 / 30)).toBe(30);
    expect(gifDelayMs(3)).toBe(3000);
  });

  it('never emits a delay browsers would clamp away', () => {
    expect(gifDelayMs(0)).toBe(20);
    expect(gifDelayMs(0.001)).toBe(20);
  });
});

describe('exportGuideAsGif', () => {
  it('writes the video frame timeline at the GIF frame rate', async () => {
    const steps = [makeStep(0), makeStep(1)];
    await exportGuideAsGif(guide, steps, shotsFor(steps), opts());

    expect(rec.written).toHaveLength(totalStepFrames(2, SPEC.fps));
    expect(rec.written.every((f) => f.width === SPEC.width && f.height === SPEC.height)).toBe(true);
    expect(rec.finished).toBe(1);
  });

  it('gives every frame its own palette so a branded cover cannot tint the rest', async () => {
    const steps = [makeStep(0)];
    const { quantize } = await import('gifenc');
    vi.mocked(quantize).mockClear();

    await exportGuideAsGif(guide, steps, shotsFor(steps), opts({ cover: true }));

    expect(quantize).toHaveBeenCalledTimes(totalStepFrames(1, SPEC.fps) + 2);
    expect(rec.written.every((f) => f.options.palette !== undefined)).toBe(true);
  });

  it('loops forever', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsGif(guide, steps, shotsFor(steps), opts());
    expect(rec.written[0]!.options).toMatchObject({ repeat: 0 });
  });

  it('adds the cover and end cards when asked', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsGif(guide, steps, shotsFor(steps), opts({ cover: true }));

    expect(rec.written).toHaveLength(totalStepFrames(1, SPEC.fps) + 2);
  });

  it('skips a step that has neither a screenshot nor a block', async () => {
    const steps = [makeStep(0), makeStep(1)];
    const screenshots = shotsFor(steps);
    screenshots.delete('s1');

    await exportGuideAsGif(guide, steps, screenshots, opts());
    expect(rec.written).toHaveLength(totalStepFrames(1, SPEC.fps));
  });

  it('reports progress up to the frame total', async () => {
    const steps = [makeStep(0)];
    const onProgress = vi.fn();

    await exportGuideAsGif(guide, steps, shotsFor(steps), opts(), { onProgress });
    const total = totalStepFrames(1, SPEC.fps);
    expect(onProgress).toHaveBeenCalledTimes(total);
    expect(onProgress).toHaveBeenLastCalledWith(total, total);
  });

  it('refuses a guide with nothing to draw', async () => {
    await expect(exportGuideAsGif(guide, [makeStep(0)], new Map(), opts())).rejects.toThrow(/no screenshots/);
  });

  it('aborts without encoding anything', async () => {
    const steps = [makeStep(0)];
    const controller = new AbortController();
    controller.abort();

    await expect(
      exportGuideAsGif(guide, steps, shotsFor(steps), opts(), { signal: controller.signal }),
    ).rejects.toThrow(DOMException);
    expect(rec.written).toHaveLength(0);
  });
});
