// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { exportGuideAsHTML } from '@/core/export/html-export';
import { DEFAULT_EXPORT_OPTIONS } from '@/core/export/options';
import type { Guide, Screenshot, Step } from '@/core/guides/types';

const rendered = vi.hoisted(() => vi.fn());

vi.mock('@/core/screenshot/render', () => ({ renderScreenshot: rendered }));

const guide: Guide = {
  id: 'guide-1',
  title: 'Test Guide',
  createdAt: new Date('2025-06-01T00:00:00Z').getTime(),
  updatedAt: new Date('2025-06-01T00:00:00Z').getTime(),
  stepIds: [],
  starred: false,
  deletedAt: null,
};

function makeStep(index: number): Step {
  return {
    id: `step-${index}`,
    guideId: 'guide-1',
    index,
    description: `Click the button ${index}`,
    action: 'click',
    url: 'https://example.com/page',
    timestamp: guide.createdAt,
  };
}

function makeScreenshot(stepId: string, edits?: Screenshot['edits']): Screenshot {
  return {
    id: `shot-${stepId}`,
    stepId,
    blob: new Blob(['raw'], { type: 'image/png' }),
    mimeType: 'image/png',
    width: 1280,
    height: 800,
    edits,
  };
}

function render(steps: Step[], screenshots: Map<string, Screenshot>) {
  return exportGuideAsHTML(guide, steps, screenshots, DEFAULT_EXPORT_OPTIONS);
}

describe('exportGuideAsHTML screenshot embedding', () => {
  beforeEach(() => {
    rendered.mockReset();
    rendered.mockImplementation(async () => new Blob(['rendered'], { type: 'image/webp' }));
  });

  it('renders every step, with no cap', async () => {
    const steps = Array.from({ length: 50 }, (_, i) => makeStep(i));
    const screenshots = new Map(steps.map((s) => [s.id, makeScreenshot(s.id)]));

    const html = await render(steps, screenshots);

    expect(rendered).toHaveBeenCalledTimes(50);
    expect(html.match(/data-step="/g)).toHaveLength(50);
    expect(html).toContain('data-step="50"');
  });

  it('reuses the rendered image when the same screenshot is exported again', async () => {
    const steps = [makeStep(0)];
    const screenshots = new Map([[steps[0].id, makeScreenshot(steps[0].id)]]);

    await render(steps, screenshots);
    await render(steps, screenshots);

    expect(rendered).toHaveBeenCalledTimes(1);
  });

  it('re-renders when the screenshot edits change', async () => {
    const steps = [makeStep(0)];
    const shot = makeScreenshot(steps[0].id, { annotations: [] } as unknown as Screenshot['edits']);
    const screenshots = new Map([[steps[0].id, shot]]);

    await render(steps, screenshots);
    shot.edits = { annotations: [{ id: 'a' }] } as unknown as Screenshot['edits'];
    await render(steps, screenshots);

    expect(rendered).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed render', async () => {
    const steps = [makeStep(0)];
    const screenshots = new Map([[steps[0].id, makeScreenshot(steps[0].id)]]);

    rendered.mockRejectedValueOnce(new Error('decode failed'));
    await expect(render(steps, screenshots)).rejects.toThrow('decode failed');

    await render(steps, screenshots);
    expect(rendered).toHaveBeenCalledTimes(2);
  });
});

describe('exportGuideAsHTML font', () => {
  it('carries its own Poppins and asks no one else for a font', async () => {
    const html = await render([makeStep(0)], new Map());
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
    for (const weight of [400, 600, 700]) {
      expect(html).toMatch(
        new RegExp(`font-weight: ${weight}; font-display: swap; src: url\\(data:font/woff2;base64,`),
      );
    }
  });
});

describe('exportGuideAsHTML mixed browser and desktop steps', () => {
  beforeEach(() => {
    rendered.mockReset();
    rendered.mockImplementation(async () => new Blob(['rendered'], { type: 'image/webp' }));
  });

  it('links a browser step and renders a desktop step as plain text', async () => {
    const browserStep = makeStep(0);
    const desktopStep: Step = {
      ...makeStep(1),
      url: '',
      app: { name: 'Excel', id: 'com.microsoft.Excel' },
      window: { title: 'Budget.xlsx' },
    };
    const shots = new Map([
      [browserStep.id, makeScreenshot(browserStep.id)],
      [desktopStep.id, makeScreenshot(desktopStep.id)],
    ]);

    const html = await render([browserStep, desktopStep], shots);

    expect(html).toContain('<a href="https://example.com/page"');
    expect(html).toContain('example.com/page');
    expect(html).toContain('Excel — Budget.xlsx');
    expect(html).not.toContain('<a href="">');
    expect(html.match(/Excel — Budget\.xlsx<\/a>/)).toBeNull();
  });
});
