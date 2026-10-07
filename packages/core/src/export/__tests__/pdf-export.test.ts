import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExportOptions } from '@/core/export/options';
import { DEFAULT_EXPORT_OPTIONS } from '@/core/export/options';
import type { Guide, Screenshot, Step } from '@/core/guides/types';

const BROKEN_LOGO = vi.hoisted(() => 'data:image/png;base64,BROKEN');

const state = vi.hoisted(() => ({
  calls: [] as { m: string; a: unknown[] }[],
  pages: 1,
  current: 1,
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

vi.mock('jspdf', () => {
  const record =
    (m: string) =>
    (...a: unknown[]) => {
      state.calls.push({ m, a });
    };
  class FakeDoc {
    setFontSize = record('setFontSize');
    setFont = record('setFont');
    setTextColor = record('setTextColor');
    setDrawColor = record('setDrawColor');
    setLineWidth = record('setLineWidth');
    text = record('text');
    textWithLink = record('textWithLink');
    line = record('line');
    rect = record('rect');
    roundedRect = record('roundedRect');
    setFillColor = record('setFillColor');

    addImage(...a: unknown[]) {
      state.calls.push({ m: 'addImage', a });
      if (a[0] === BROKEN_LOGO) throw new Error('unsupported image format');
    }

    addPage(...a: unknown[]) {
      state.calls.push({ m: 'addPage', a });
      state.pages += 1;
      state.current = state.pages;
    }

    setPage(p: number) {
      state.calls.push({ m: 'setPage', a: [p] });
      state.current = p;
    }

    getNumberOfPages() {
      return state.pages;
    }

    splitTextToSize(text: string) {
      return String(text).split('\n');
    }

    getTextWidth(text: string) {
      return String(text).length * 1.6;
    }

    output() {
      return new Blob(['pdf']);
    }
  }
  return { jsPDF: FakeDoc };
});

vi.mock('@/core/screenshot/render', () => ({
  renderScreenshot: vi.fn(async () => new Blob(['jpeg'])),
}));

vi.mock('@/core/export/branding', async () => {
  const actual = await vi.importActual<typeof import('@/core/export/branding')>('@/core/export/branding');
  return { ...actual, loadBranding: vi.fn(async () => branding.value) };
});

vi.mock('@/core/export/utils', async () => {
  const actual = await vi.importActual<typeof import('@/core/export/utils')>('@/core/export/utils');
  return { ...actual, blobToDataUrl: vi.fn(async () => 'data:image/jpeg;base64,AAA') };
});

const { exportGuideAsPDF } = await import('@/core/export/pdf-export');
const { renderScreenshot } = await import('@/core/screenshot/render');

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
    description: `Step number ${i}`,
    action: 'click',
    url: 'https://example.com/settings',
    timestamp: guide.createdAt,
    screenshotId: `shot-${i}`,
    ...overrides,
  };
}

function makeShot(stepId: string): Screenshot {
  return {
    id: `shot-${stepId}`,
    stepId,
    blob: new Blob(['raw']),
    mimeType: 'image/jpeg',
    width: 800,
    height: 1600,
  };
}

function shotsFor(steps: Step[]): Map<string, Screenshot> {
  return new Map(steps.map((s) => [s.id, makeShot(s.id)]));
}

const opts = (o: Partial<ExportOptions> = {}): ExportOptions => ({ ...DEFAULT_EXPORT_OPTIONS, ...o });

const texts = () =>
  state.calls
    .filter((c) => c.m === 'text' || c.m === 'textWithLink')
    .flatMap((c) => (Array.isArray(c.a[0]) ? (c.a[0] as string[]) : [String(c.a[0])]));

const count = (m: string) => state.calls.filter((c) => c.m === m).length;

beforeEach(() => {
  state.calls = [];
  state.pages = 1;
  state.current = 1;
  branding.value = { logo: null, footer: '', attribution: false, accent: '#4F46E5', custom: false };
  vi.mocked(renderScreenshot).mockClear();
  vi.mocked(renderScreenshot).mockResolvedValue(new Blob(['jpeg']));
});

describe('exportGuideAsPDF', () => {
  it('returns a blob', async () => {
    const steps = [makeStep(0)];
    await expect(exportGuideAsPDF(guide, steps, shotsFor(steps), opts())).resolves.toBeInstanceOf(Blob);
  });

  it('puts the title and step count on a cover page', async () => {
    const steps = [makeStep(0), makeStep(1), makeStep(2)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: true }));

    expect(texts()).toContain('Reset your password');
    expect(texts()).toContain('03');
  });

  it('omits the cover when the option is off', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(texts()).not.toContain('export.guideLabel');
  });

  it('writes the guide description as a cover paragraph', async () => {
    const steps = [makeStep(0)];
    const withDesc = { ...guide, description: 'How to recover access' };
    await exportGuideAsPDF(withDesc, steps, shotsFor(steps), opts({ cover: true }));

    expect(texts()).toContain('How to recover access');
  });

  it('writes the description as a lead paragraph when there is no cover', async () => {
    const steps = [makeStep(0)];
    const withDesc = { ...guide, description: 'How to recover access' };
    await exportGuideAsPDF(withDesc, steps, shotsFor(steps), opts({ cover: false }));

    expect(texts()).toContain('How to recover access');
  });
});

describe('exportGuideAsPDF pagination', () => {
  it('starts a new page once the steps stop fitting', async () => {
    const steps = Array.from({ length: 8 }, (_, i) => makeStep(i));
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(count('addPage')).toBeGreaterThan(0);
    expect(state.pages).toBeGreaterThan(1);
  });

  it('keeps a single tall step on one page rather than looping onto blank pages', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(count('addPage')).toBe(0);
  });

  it('adds a page for the first step block when a cover is present', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: true }));

    expect(count('addPage')).toBe(1);
  });

  it('numbers every page against the total', async () => {
    const steps = Array.from({ length: 6 }, (_, i) => makeStep(i));
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false }));

    const total = state.pages;
    for (let p = 1; p <= total; p++) {
      expect(texts()).toContain(`${p} / ${total}`);
    }
  });

  it('visits each page once when stamping the footer', async () => {
    const steps = Array.from({ length: 6 }, (_, i) => makeStep(i));
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false }));

    const visited = state.calls.filter((c) => c.m === 'setPage').map((c) => c.a[0]);
    expect(visited).toEqual(Array.from({ length: state.pages }, (_, i) => i + 1));
  });

  it('labels a page carrying one step differently from a range', async () => {
    const steps = Array.from({ length: 4 }, (_, i) => makeStep(i));
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false }));

    const labels = texts().filter((t) => t.startsWith('export.step'));
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some((l) => l.startsWith('export.stepOf') || l.startsWith('export.stepsRange'))).toBe(true);
  });
});

describe('exportGuideAsPDF screenshots', () => {
  it('renders and embeds a screenshot per step', async () => {
    const steps = [makeStep(0), makeStep(1)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(renderScreenshot).toHaveBeenCalledTimes(2);
    expect(count('addImage')).toBe(2);
  });

  it('skips screenshots entirely when the option is off', async () => {
    const steps = [makeStep(0), makeStep(1)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false, screenshots: false }));

    expect(renderScreenshot).not.toHaveBeenCalled();
    expect(count('addImage')).toBe(0);
  });

  it('renders as jpeg so the pdf stays small', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(vi.mocked(renderScreenshot).mock.calls[0]![1]).toMatchObject({ format: 'image/jpeg' });
  });

  it('still writes the step when its screenshot fails to render', async () => {
    vi.mocked(renderScreenshot).mockRejectedValueOnce(new Error('decode failed'));
    const steps = [makeStep(0)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(texts()).toContain('Step number 0');
    expect(count('addImage')).toBe(0);
  });

  it('writes invisible alt text alongside the image', async () => {
    const steps = [makeStep(0)];
    const shots = shotsFor(steps);
    shots.get('s0')!.edits = { alt: 'The settings page' };
    await exportGuideAsPDF(guide, steps, shots, opts({ cover: false }));

    expect(texts()).toContain('The settings page');
    const invisible = state.calls.filter((c) => (c.a[3] as { renderingMode?: string })?.renderingMode === 'invisible');
    expect(invisible.length).toBe(1);
  });

  it('falls back to a generated alt label when none is set', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(texts().some((t) => t.startsWith('export.stepLabel'))).toBe(true);
  });
});

describe('exportGuideAsPDF step urls', () => {
  it('links the step url when the option is on', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false, stepUrls: true }));

    const links = state.calls.filter((c) => c.m === 'textWithLink');
    expect(links.some((c) => (c.a[3] as { url?: string })?.url === 'https://example.com/settings')).toBe(true);
  });

  it('omits the url when the option is off', async () => {
    const steps = [makeStep(0)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false, stepUrls: false }));

    const links = state.calls.filter((c) => c.m === 'textWithLink');
    expect(links.some((c) => (c.a[3] as { url?: string })?.url === 'https://example.com/settings')).toBe(false);
  });

  it('wraps a long url onto its own line instead of running off the page', async () => {
    const long = `https://example.com/${'segment/'.repeat(30)}`;
    const steps = [makeStep(0, { url: long, description: 'A fairly long step description here' })];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false, stepUrls: true }));

    const sep = state.calls.filter((c) => c.m === 'text' && c.a[0] === '   ·   ');
    expect(sep.length).toBe(0);
  });

  it('leaves a step without a url alone', async () => {
    const steps = [makeStep(0, { url: '' })];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false, stepUrls: true }));

    expect(count('textWithLink')).toBe(0);
  });

  it('shortens a url to host and path', async () => {
    const steps = [makeStep(0, { url: 'https://www.example.com/settings/profile' })];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false, stepUrls: true }));

    expect(texts()).toContain('example.com/settings/profile');
  });

  it('drops a bare root path from the label', async () => {
    const steps = [makeStep(0, { url: 'https://example.com/' })];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false, stepUrls: true }));

    expect(texts()).toContain('example.com');
  });

  it('falls back to the raw value when the url cannot be parsed', async () => {
    const steps = [makeStep(0, { url: 'not a url' })];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false, stepUrls: true }));

    expect(texts()).toContain('not a url');
  });

  it('truncates a very long label', async () => {
    const steps = [makeStep(0, { url: `https://example.com/${'a'.repeat(200)}` })];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false, stepUrls: true }));

    const label = texts().find((t) => t.startsWith('example.com/aaa'));
    expect(label).toBeDefined();
    expect(label?.length).toBe(64);
    expect(label?.endsWith('…')).toBe(true);
  });
});

describe('exportGuideAsPDF branding', () => {
  it('stamps the footer line on every page', async () => {
    branding.value = { ...branding.value, footer: 'Acme internal' };
    const steps = Array.from({ length: 5 }, (_, i) => makeStep(i));
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false }));

    const footers = texts().filter((t) => t === 'Acme internal');
    expect(footers.length).toBe(state.pages);
  });

  it('adds the attribution when it is enabled', async () => {
    branding.value = { ...branding.value, attribution: true };
    const steps = [makeStep(0)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(texts()).toContain('export.madeWith');
  });

  it('leaves the attribution out when it is disabled', async () => {
    branding.value = { ...branding.value, attribution: false };
    const steps = [makeStep(0)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(texts()).not.toContain('export.madeWith');
  });

  it('draws the logo on the cover', async () => {
    branding.value = {
      ...branding.value,
      logo: { dataUrl: 'data:image/png;base64,AAA', width: 100, height: 40 },
    };
    const steps = [makeStep(0)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: true, screenshots: false }));

    expect(count('addImage')).toBe(1);
  });

  it('repeats a small logo in the running head when there is no cover', async () => {
    branding.value = {
      ...branding.value,
      logo: { dataUrl: 'data:image/png;base64,AAA', width: 100, height: 40 },
    };
    const steps = Array.from({ length: 5 }, (_, i) => makeStep(i));
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false, screenshots: false }));

    expect(count('addImage')).toBe(state.pages);
  });

  it('still produces a pdf when the cover logo fails to draw', async () => {
    branding.value = { ...branding.value, logo: { dataUrl: BROKEN_LOGO, width: 100, height: 40 } };
    const steps = [makeStep(0)];
    await expect(
      exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: true, screenshots: false })),
    ).resolves.toBeInstanceOf(Blob);
  });

  it('still produces a pdf when the running head logo fails to draw', async () => {
    branding.value = { ...branding.value, logo: { dataUrl: BROKEN_LOGO, width: 100, height: 40 } };
    const steps = Array.from({ length: 5 }, (_, i) => makeStep(i));
    await expect(
      exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false, screenshots: false })),
    ).resolves.toBeInstanceOf(Blob);
    expect(state.pages).toBeGreaterThan(0);
  });
});

describe('exportGuideAsPDF blocks', () => {
  it('renders a heading block without a step number', async () => {
    const steps = [makeStep(0, { blockType: 'heading', description: 'Part one' }), makeStep(1)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(texts()).toContain('Part one');
  });

  it('renders a callout block', async () => {
    const steps = [makeStep(0, { blockType: 'callout', description: 'Remember to save' }), makeStep(1)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: false }));

    expect(texts()).toContain('Remember to save');
  });

  it('numbers only the action steps', async () => {
    const steps = [makeStep(0, { blockType: 'heading', description: 'Part one' }), makeStep(1), makeStep(2)];
    await exportGuideAsPDF(guide, steps, shotsFor(steps), opts({ cover: true }));

    expect(texts()).toContain('02');
  });
});
