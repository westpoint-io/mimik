import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import type { Guide, Screenshot, Step } from '@/core/guides/types';

vi.mock('@/core/screenshot/render', () => ({
  renderScreenshot: async () => new Blob(['pixels'], { type: 'image/webp' }),
}));
vi.mock('@/core/export/markdown-export', () => ({
  exportGuideAsMarkdown: async (guide: Guide, steps: Step[]) =>
    [`# ${guide.title}`, ...steps.map((s) => s.description)].join('\n'),
}));

import { DEFAULT_BUNDLE_OPTIONS, exportGuideAsBundle, trimUrl } from '../bundle';
import { MANIFEST_PATH, parseManifest, README_PATH } from '../schema';
import { SCRUB_PLACEHOLDER } from '../scrub';

function makeGuide(): Guide {
  return {
    id: 'guide-1',
    title: 'Reset a password',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    stepIds: ['step-1'],
    starred: true,
    deletedAt: null,
  };
}

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    id: 'step-1',
    guideId: 'guide-1',
    index: 0,
    description: 'Type "hunter2" in the password box',
    action: 'input',
    url: 'https://app.example.com/settings/security?token=secret#anchor',
    timestamp: 1_700_000_000_000,
    screenshotId: 'ss-1',
    aiPending: true,
    inputValue: 'hunter2',
    ...overrides,
  };
}

function makeScreenshot(): Screenshot {
  return {
    id: 'ss-1',
    stepId: 'step-1',
    blob: new Blob(['raw'], { type: 'image/png' }),
    mimeType: 'image/png',
    width: 800,
    height: 600,
  };
}

async function unpack(blob: Blob) {
  const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  return { entries, manifest: parseManifest(JSON.parse(strFromU8(entries[MANIFEST_PATH]))) };
}

describe('trimUrl', () => {
  const url = 'https://app.example.com/settings/security?token=secret#anchor';

  it('keeps everything in full mode', () => {
    expect(trimUrl(url, 'full')).toBe(url);
  });

  it('drops the query and fragment in path mode', () => {
    expect(trimUrl(url, 'path')).toBe('https://app.example.com/settings/security');
  });

  it('keeps only the origin in origin mode', () => {
    expect(trimUrl(url, 'origin')).toBe('https://app.example.com');
  });

  it('discards a URL it cannot parse rather than passing it through', () => {
    expect(trimUrl('not a url', 'path')).toBe('');
  });
});

describe('exportGuideAsBundle', () => {
  it('writes a manifest, the screenshots and a readable markdown copy', async () => {
    const { entries, manifest } = await unpack(
      await exportGuideAsBundle(makeGuide(), [makeStep()], new Map([['step-1', makeScreenshot()]])),
    );

    expect(Object.keys(entries).sort()).toEqual([README_PATH, MANIFEST_PATH, 'screenshots/ss-1.webp']);
    expect(strFromU8(entries[README_PATH])).toContain('# Reset a password');
    expect(manifest.guide.title).toBe('Reset a password');
    expect(manifest.screenshots[0].file).toBe('screenshots/ss-1.webp');
  });

  it('scrubs the typed value out of the description, not just the inputValue field', async () => {
    const { entries, manifest } = await unpack(
      await exportGuideAsBundle(makeGuide(), [makeStep()], new Map([['step-1', makeScreenshot()]])),
    );

    expect(JSON.stringify(manifest)).not.toContain('hunter2');
    expect(manifest.steps[0].description).toBe(`Type "${SCRUB_PLACEHOLDER}" in the password box`);
    expect(strFromU8(entries[README_PATH])).not.toContain('hunter2');
  });

  it('scrubs a title that quotes the typed value', async () => {
    const guide = { ...makeGuide(), title: 'Set hunter2 as the password', description: 'Uses hunter2 throughout' };
    const { manifest } = await unpack(
      await exportGuideAsBundle(guide, [makeStep()], new Map([['step-1', makeScreenshot()]])),
    );

    expect(manifest.guide.title).toBe(`Set ${SCRUB_PLACEHOLDER} as the password`);
    expect(manifest.guide.description).toBe(`Uses ${SCRUB_PLACEHOLDER} throughout`);
  });

  it('scrubs a typed value echoed by a different step', async () => {
    const later = makeStep({ id: 'step-2', index: 1, description: 'Confirm hunter2 was saved', inputValue: undefined });
    const { manifest } = await unpack(
      await exportGuideAsBundle(makeGuide(), [makeStep(), later], new Map([['step-1', makeScreenshot()]])),
    );

    expect(manifest.steps[1].description).toBe(`Confirm ${SCRUB_PLACEHOLDER} was saved`);
  });

  it('leaves descriptions intact when the author keeps typed text', async () => {
    const { manifest } = await unpack(
      await exportGuideAsBundle(makeGuide(), [makeStep()], new Map([['step-1', makeScreenshot()]]), {
        ...DEFAULT_BUNDLE_OPTIONS,
        stripInputValues: false,
      }),
    );

    expect(manifest.steps[0].description).toBe('Type "hunter2" in the password box');
  });

  it('strips typed text and trims URLs by default', async () => {
    const { manifest } = await unpack(
      await exportGuideAsBundle(makeGuide(), [makeStep()], new Map([['step-1', makeScreenshot()]])),
    );

    expect(manifest.steps[0].inputValue).toBeUndefined();
    expect(manifest.steps[0].url).toBe('https://app.example.com/settings/security');
    expect(manifest.redacted).toEqual({ screenshots: false, inputValues: true, urls: 'path' });
  });

  it('keeps typed text when the author opts in', async () => {
    const { manifest } = await unpack(
      await exportGuideAsBundle(makeGuide(), [makeStep()], new Map([['step-1', makeScreenshot()]]), {
        ...DEFAULT_BUNDLE_OPTIONS,
        stripInputValues: false,
        urls: 'full',
      }),
    );

    expect(manifest.steps[0].inputValue).toBe('hunter2');
    expect(manifest.steps[0].url).toContain('token=secret');
  });

  it('leaves capture-local state behind', async () => {
    const { manifest } = await unpack(
      await exportGuideAsBundle(makeGuide(), [makeStep()], new Map([['step-1', makeScreenshot()]])),
    );

    const step = manifest.steps[0] as Record<string, unknown>;
    expect(step.guideId).toBeUndefined();
    expect(step.aiPending).toBeUndefined();
    expect(step.screenshotId).toBeUndefined();
  });

  it('trims the href inside elementMeta too', async () => {
    const step = makeStep({
      elementMeta: {
        tag: 'a',
        cssSelector: 'a.link',
        textContent: 'Security',
        ariaLabel: null,
        placeholder: null,
        altText: null,
        name: null,
        role: null,
        href: 'https://app.example.com/go?session=abc',
        inputType: null,
        dataTestId: null,
        rect: { x: 0, y: 0, width: 10, height: 10 },
        devicePixelRatio: 1,
      },
    });

    const { manifest } = await unpack(
      await exportGuideAsBundle(makeGuide(), [step], new Map([['step-1', makeScreenshot()]])),
    );

    expect(manifest.steps[0].elementMeta?.href).toBe('https://app.example.com/go');
  });

  it('reports a redaction in the manifest so the import screen can disclose it', async () => {
    const shot = makeScreenshot();
    shot.edits = { annotations: [{ id: 'r1', type: 'redact', x: 1, y: 2, w: 3, h: 4, style: 'blur' }] };
    const { manifest } = await unpack(
      await exportGuideAsBundle(makeGuide(), [makeStep()], new Map([['step-1', shot]])),
    );

    expect(manifest.redacted.screenshots).toBe(true);
  });

  it('does not claim a redaction when the author only cropped', async () => {
    const shot = makeScreenshot();
    shot.edits = { viewport: { x: 10, y: 10, width: 100, height: 100 } };
    const { manifest } = await unpack(
      await exportGuideAsBundle(makeGuide(), [makeStep()], new Map([['step-1', shot]])),
    );

    expect(manifest.redacted.screenshots).toBe(false);
  });

  it('leaves an opaque-origin URL whole instead of turning it into "null/..."', async () => {
    expect(trimUrl('file:///Users/x/doc.html', 'path')).toBe('file:///Users/x/doc.html');
    expect(trimUrl('about:blank', 'origin')).toBe('about:blank');
    expect(trimUrl('chrome://extensions/', 'path')).toBe('chrome://extensions/');
  });

  it('drops the captured text of the field that was typed into', async () => {
    const long = 'x'.repeat(200);
    const step = makeStep({
      inputValue: long,
      description: 'Type into the box',
      elementMeta: {
        tag: 'div',
        cssSelector: 'div.editor',
        textContent: long.slice(0, 80),
        ariaLabel: 'Message',
        placeholder: null,
        altText: null,
        name: null,
        role: 'textbox',
        href: null,
        inputType: null,
        dataTestId: null,
        rect: { x: 0, y: 0, width: 10, height: 10 },
        devicePixelRatio: 1,
      },
    });

    const { manifest } = await unpack(
      await exportGuideAsBundle(makeGuide(), [step], new Map([['step-1', makeScreenshot()]])),
    );

    expect(manifest.steps[0].elementMeta?.textContent).toBeNull();
    expect(JSON.stringify(manifest)).not.toContain('xxxxxxxxxx');
    expect(manifest.steps[0].elementMeta?.ariaLabel).toBe('Message');
    expect(manifest.steps[0].elementMeta?.cssSelector).toBe('div.editor');
  });

  it('handles a step with no screenshot', async () => {
    const { manifest } = await unpack(await exportGuideAsBundle(makeGuide(), [makeStep()], new Map()));
    expect(manifest.screenshots).toEqual([]);
    expect(manifest.steps).toHaveLength(1);
  });
});
