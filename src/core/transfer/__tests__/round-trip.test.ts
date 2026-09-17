import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.BroadcastChannel = class {
    postMessage() {}
    addEventListener() {}
    removeEventListener() {}
    close() {}
  } as unknown as typeof BroadcastChannel;
});

vi.mock('@/core/screenshot/render', () => ({
  renderScreenshot: async () => new Blob(['flattened'], { type: 'image/webp' }),
}));
vi.mock('@/core/export/markdown-export', () => ({
  exportGuideAsMarkdown: async () => '# guide',
}));

import { db } from '@/core/guides/db';
import { getGuide, importGuide } from '@/core/guides/service';
import type { Guide, Screenshot, Step } from '@/core/guides/types';
import { exportGuideAsBundle } from '../bundle';
import { readBundle } from '../parse';

const guide: Guide = {
  id: 'guide-1',
  title: 'Reset a password',
  description: 'For support agents',
  createdAt: 1_600_000_000_000,
  updatedAt: 1_600_000_000_000,
  stepIds: ['step-1', 'step-2', 'step-3'],
  starred: true,
  deletedAt: null,
};

const steps: Step[] = [
  {
    id: 'step-1',
    guideId: 'guide-1',
    index: 0,
    description: 'Open the security page',
    action: 'click',
    url: 'https://app.example.com/settings?session=abc',
    timestamp: 1,
    screenshotId: 'ss-1',
    descriptionSource: 'narration',
    elementMeta: {
      tag: 'a',
      cssSelector: 'nav a.security',
      textContent: 'Security',
      ariaLabel: null,
      placeholder: null,
      altText: null,
      name: null,
      role: 'link',
      href: 'https://app.example.com/settings',
      inputType: null,
      dataTestId: 'nav-security',
      rect: { x: 10, y: 20, width: 80, height: 24 },
      devicePixelRatio: 2,
    },
  },
  {
    id: 'step-2',
    guideId: 'guide-1',
    index: 1,
    description: 'A word of warning',
    action: 'block',
    url: '',
    timestamp: 2,
    blockType: 'callout',
    calloutVariant: 'warning',
  },
  {
    id: 'step-3',
    guideId: 'guide-1',
    index: 2,
    description: 'Type the new password',
    action: 'input',
    url: 'https://app.example.com/settings/security',
    timestamp: 3,
    screenshotId: 'ss-3',
    inputValue: 'hunter2',
  },
];

const screenshots = new Map<string, Screenshot>([
  [
    'step-1',
    {
      id: 'ss-1',
      stepId: 'step-1',
      blob: new Blob(['raw-1'], { type: 'image/png' }),
      mimeType: 'image/png',
      width: 1000,
      height: 800,
      bounds: { x: 10, y: 20, width: 80, height: 24 },
      pixelRatio: 2,
      edits: {
        annotations: [
          { id: 'r1', type: 'redact', x: 400, y: 300, w: 120, h: 30, style: 'blur' },
          { id: 'a1', type: 'arrow', x1: 10, y1: 10, x2: 90, y2: 90, color: '#EF4444' },
        ],
        alt: 'the security link',
      },
    },
  ],
  [
    'step-3',
    {
      id: 'ss-3',
      stepId: 'step-3',
      blob: new Blob(['raw-3'], { type: 'image/png' }),
      mimeType: 'image/png',
      width: 1000,
      height: 800,
    },
  ],
]);

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function roundTrip() {
  const file = await exportGuideAsBundle(guide, steps, screenshots);
  const guideId = await importGuide(await readBundle(file));
  const loaded = await getGuide(guideId);
  if (!loaded) throw new Error('imported guide not found');
  return loaded;
}

describe('bundle round trip', () => {
  it('rebuilds the guide on the other side', async () => {
    const { guide: imported, steps: importedSteps } = await roundTrip();

    expect(imported.title).toBe('Reset a password');
    expect(imported.description).toBe('For support agents');
    expect(importedSteps.map((s) => s.description)).toEqual([
      'Open the security page',
      'A word of warning',
      'Type the new password',
    ]);
    expect(importedSteps.map((s) => s.index)).toEqual([0, 1, 2]);
  });

  it('carries the editorial structure a guide depends on', async () => {
    const { steps: importedSteps } = await roundTrip();

    expect(importedSteps[1].blockType).toBe('callout');
    expect(importedSteps[1].calloutVariant).toBe('warning');
    expect(importedSteps[0].descriptionSource).toBe('narration');
  });

  it('keeps the element metadata Guide Me matches on', async () => {
    const { steps: importedSteps } = await roundTrip();
    const meta = importedSteps[0].elementMeta;

    expect(meta?.cssSelector).toBe('nav a.security');
    expect(meta?.textContent).toBe('Security');
    expect(meta?.dataTestId).toBe('nav-security');
    expect(meta?.role).toBe('link');
  });

  it('leaves the redaction behind and keeps the ordinary annotation', async () => {
    const { steps: importedSteps, screenshots: importedShots } = await roundTrip();
    const shot = importedShots.get(importedSteps[0].id);

    expect(shot?.edits?.annotations?.map((a) => a.type)).toEqual(['arrow']);
    expect(shot?.edits?.alt).toBe('the security link');
    expect(await shot?.blob.text()).toBe('flattened');
  });

  it('strips the secrets the defaults promise to strip', async () => {
    const { steps: importedSteps } = await roundTrip();

    expect(importedSteps[2].inputValue).toBeUndefined();
    expect(importedSteps[0].url).toBe('https://app.example.com/settings');
  });

  it('attaches each screenshot to the right step and leaves the blockless step bare', async () => {
    const { steps: importedSteps, screenshots: importedShots } = await roundTrip();

    expect(importedShots.size).toBe(2);
    expect(importedShots.get(importedSteps[0].id)?.stepId).toBe(importedSteps[0].id);
    expect(importedSteps[1].screenshotId).toBeUndefined();
  });

  it('carries non-ascii text through the zip intact', async () => {
    const accented: Guide = { ...guide, title: 'Redefinir a senha · 中文 · café', description: 'Für Support — naïve' };
    const file = await exportGuideAsBundle(accented, steps, screenshots);
    const { guide: imported } = (await getGuide(await importGuide(await readBundle(file))))!;

    expect(imported.title).toBe('Redefinir a senha · 中文 · café');
    expect(imported.description).toBe('Für Support — naïve');
  });

  it("lands as a fresh guide rather than the author's", async () => {
    const { guide: imported } = await roundTrip();

    expect(imported.id).not.toBe('guide-1');
    expect(imported.starred).toBe(false);
    expect(imported.createdAt).toBeGreaterThan(1_600_000_000_000);
  });
});
