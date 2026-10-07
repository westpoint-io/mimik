// @vitest-environment jsdom
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { exportGuideAsDOCX, fitDocxImageSize } from '@/core/export/docx-export';
import type { Guide, Screenshot, Step } from '@/core/guides/types';

const rendered = vi.hoisted(() => vi.fn(async () => new Blob(['rendered'], { type: 'image/png' })));

vi.mock('@/core/screenshot/render', () => ({ renderScreenshot: rendered }));

function makeGuide(overrides: Partial<Guide> = {}): Guide {
  return {
    id: 'guide-1',
    title: 'Test Guide',
    createdAt: new Date('2025-06-01T00:00:00Z').getTime(),
    updatedAt: new Date('2025-06-01T00:00:00Z').getTime(),
    stepIds: [],
    starred: false,
    deletedAt: null,
    ...overrides,
  };
}

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    id: 'step-1',
    guideId: 'guide-1',
    index: 0,
    description: 'Click the button',
    action: 'click',
    url: 'https://example.com',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeScreenshot(stepId: string, content = 'image-data'): Screenshot {
  return {
    id: `ss-${stepId}`,
    stepId,
    blob: new Blob([content], { type: 'image/png' }),
    mimeType: 'image/png',
    width: 800,
    height: 600,
  };
}

async function unzipDocx(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return unzipSync(bytes);
}

async function readDocumentXml(blob: Blob): Promise<string> {
  const files = await unzipDocx(blob);
  return strFromU8(files['word/document.xml']!);
}

describe('exportGuideAsDOCX', () => {
  it('creates a non-empty docx blob with guide metadata and step content', async () => {
    const guide = makeGuide({ title: 'My Guide' });
    const steps = [makeStep()];
    const blob = await exportGuideAsDOCX(guide, steps, new Map());

    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    const xml = await readDocumentXml(blob);
    expect(xml).toContain('My Guide');
    expect(xml).toContain('EXPORT.STEPS');
    expect(xml).toContain('>01</w:t>');
    expect(xml).toContain('EXPORT.CREATED');
    expect(xml).toContain('EXPORT.SOURCE');
    expect(xml).toContain('example.com');
    expect(xml).toContain('<w:pageBreakBefore/>');
    expect(xml).toContain('Click the button');
  });

  it('handles guides with no steps', async () => {
    const blob = await exportGuideAsDOCX(makeGuide(), [], new Map());
    const xml = await readDocumentXml(blob);

    expect(xml).toContain('Test Guide');
    expect(xml).toContain('EXPORT.STEPS');
    expect(xml).toContain('>00</w:t>');
    expect(xml).not.toContain('Click the button');
  });

  it('embeds screenshot media when steps have screenshots', async () => {
    const step = makeStep();
    const screenshots = new Map<string, Screenshot>([[step.id, makeScreenshot(step.id)]]);

    const blob = await exportGuideAsDOCX(makeGuide(), [step], screenshots);
    const files = await unzipDocx(blob);

    expect(Object.keys(files).some((name) => name.startsWith('word/media/'))).toBe(true);
  });

  it('does not add media files when screenshots are missing', async () => {
    const blob = await exportGuideAsDOCX(makeGuide(), [makeStep()], new Map());
    const files = await unzipDocx(blob);

    expect(Object.keys(files).some((name) => name.startsWith('word/media/'))).toBe(false);
  });

  it('includes the guide description', async () => {
    const guide = makeGuide({ description: 'A short SOP narrative.' });
    const xml = await readDocumentXml(await exportGuideAsDOCX(guide, [makeStep()], new Map()));

    expect(xml).toContain('A short SOP narrative.');
  });

  it('embeds the rendered screenshot so annotations and redactions are applied', async () => {
    rendered.mockClear();
    const step = makeStep();
    const screenshot = makeScreenshot(step.id, 'raw-pixels');
    screenshot.edits = {
      annotations: [{ id: 'r1', type: 'redact', x: 0, y: 0, w: 10, h: 10, style: 'solid' }],
    };

    const blob = await exportGuideAsDOCX(makeGuide(), [step], new Map([[step.id, screenshot]]));
    const files = await unzipDocx(blob);
    const media = Object.keys(files).filter((name) => name.startsWith('word/media/') && files[name]!.length > 0);

    expect(rendered).toHaveBeenCalledWith(screenshot, expect.objectContaining({ format: 'image/png' }));
    expect(media).toHaveLength(1);
    expect(strFromU8(files[media[0]!]!)).toBe('rendered');
  });

  it('sizes the image from the cropped viewport, not the original bitmap', async () => {
    const step = makeStep();
    const screenshot = makeScreenshot(step.id);
    screenshot.edits = { viewport: { x: 0, y: 0, width: 400, height: 100 } };

    const xml = await readDocumentXml(await exportGuideAsDOCX(makeGuide(), [step], new Map([[step.id, screenshot]])));

    const extent = xml.match(/<wp:extent cx="(\d+)" cy="(\d+)"/);
    expect(extent).not.toBeNull();
    expect(Number(extent?.[1]) / Number(extent?.[2])).toBeCloseTo(4, 1);
  });

  it('embeds screenshots whose stored mime type is not natively supported by docx', async () => {
    const step = makeStep();
    const screenshot = makeScreenshot(step.id);
    screenshot.mimeType = 'image/webp';

    const blob = await exportGuideAsDOCX(makeGuide(), [step], new Map([[step.id, screenshot]]));
    const files = await unzipDocx(blob);

    expect(Object.keys(files).some((name) => name.startsWith('word/media/'))).toBe(true);
  });
});

describe('fitDocxImageSize', () => {
  it('preserves aspect ratio and never upscales', () => {
    expect(fitDocxImageSize(400, 300)).toEqual({ width: 400, height: 300 });
  });

  it('clamps wide screenshots to max width', () => {
    const { width, height } = fitDocxImageSize(1040, 600);
    expect(width).toBe(520);
    expect(height).toBe(300);
  });

  it('clamps tall screenshots so they fit one page', () => {
    const { width, height } = fitDocxImageSize(400, 2000);
    expect(height).toBe(640);
    expect(width).toBe(128);
  });

  it('accounts for left indent when clamping width', () => {
    const { width, height } = fitDocxImageSize(800, 600, 900);
    expect(width).toBe(475);
    expect(height).toBe(356);
  });
});
