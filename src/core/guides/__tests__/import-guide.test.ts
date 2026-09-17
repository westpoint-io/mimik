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

import type { ParsedBundle } from '@/core/transfer/parse';
import { BUNDLE_VERSION } from '@/core/transfer/schema';
import { db } from '../db';
import { createGuide, getGuide, importGuide } from '../service';
import type { Step } from '../types';

function makeBundle(overrides: Partial<ParsedBundle['manifest']> = {}): ParsedBundle {
  return {
    manifest: {
      version: BUNDLE_VERSION,
      exportedAt: 1_700_000_000_000,
      guide: { title: 'Reset a password', description: 'How to do it', createdAt: 1_600_000_000_000 },
      sourceDomain: 'app.example.com',
      redacted: { screenshots: true, inputValues: true, urls: 'path' },
      steps: [
        { id: 'step-1', index: 0, description: 'Open settings', action: 'click', url: 'https://a.test', timestamp: 1 },
        { id: 'step-2', index: 1, description: 'Click save', action: 'click', url: 'https://a.test', timestamp: 2 },
      ],
      screenshots: [
        {
          id: 'ss-1',
          stepId: 'step-1',
          file: 'screenshots/ss-1.webp',
          mimeType: 'image/webp',
          width: 800,
          height: 600,
        },
      ],
      ...overrides,
    },
    images: new Map([['screenshots/ss-1.webp', new Blob(['pixels'], { type: 'image/webp' })]]),
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('importGuide', () => {
  it('adds the guide with its steps and screenshots', async () => {
    const guideId = await importGuide(makeBundle());
    const loaded = await getGuide(guideId);

    expect(loaded?.guide.title).toBe('Reset a password');
    expect(loaded?.guide.description).toBe('How to do it');
    expect(loaded?.steps.map((s) => s.description)).toEqual(['Open settings', 'Click save']);
    expect(loaded?.screenshots.size).toBe(1);
  });

  it('mints new identifiers rather than reusing the ones in the file', async () => {
    const guideId = await importGuide(makeBundle());
    const loaded = await getGuide(guideId);

    expect(guideId).not.toBe('guide-1');
    expect(loaded?.steps.map((s) => s.id)).not.toContain('step-1');
    expect(loaded?.steps.every((s) => s.guideId === guideId)).toBe(true);
    expect(loaded?.guide.stepIds).toEqual(loaded?.steps.map((s) => s.id));
  });

  it('cannot overwrite a step the recipient already has', async () => {
    await createGuide('mine');
    const mine: Step = {
      id: 'step-1',
      guideId: 'mine',
      index: 0,
      description: 'My own step',
      action: 'click',
      url: 'https://mine.test',
      timestamp: 1,
    };
    await db.steps.add(mine);

    await importGuide(makeBundle());

    expect(await db.steps.get('step-1')).toEqual(mine);
    expect(await db.guides.count()).toBe(2);
    const imported = await getGuide((await db.guides.toArray()).find((g) => g.id !== 'mine')!.id);
    expect(imported?.steps.map((s) => s.id)).not.toContain('step-1');
  });

  it('importing the same file twice makes two independent guides', async () => {
    const first = await importGuide(makeBundle());
    const second = await importGuide(makeBundle());

    expect(first).not.toBe(second);
    const [a, b] = await Promise.all([getGuide(first), getGuide(second)]);
    expect(a?.steps[0].id).not.toBe(b?.steps[0].id);
    expect(await db.steps.count()).toBe(4);
  });

  it('points each step at its own newly minted screenshot', async () => {
    const guideId = await importGuide(makeBundle());
    const loaded = await getGuide(guideId);
    const [first, second] = loaded?.steps as Step[];
    const screenshot = loaded?.screenshots.get(first.id);

    expect(screenshot?.id).toBe(first.screenshotId);
    expect(screenshot?.id).not.toBe('ss-1');
    expect(screenshot?.stepId).toBe(first.id);
    expect(second.screenshotId).toBeUndefined();
  });

  it('clears aiPending so the editor does not wait on a job that will never run', async () => {
    const bundle = makeBundle();
    (bundle.manifest.steps[0] as Record<string, unknown>).aiPending = true;

    const loaded = await getGuide(await importGuide(bundle));
    expect(loaded?.steps.every((s) => !s.aiPending)).toBe(true);
  });

  it('resets ownership: the imported guide is new here, not starred or trashed', async () => {
    const loaded = await getGuide(await importGuide(makeBundle()));

    expect(loaded?.guide.starred).toBe(false);
    expect(loaded?.guide.deletedAt).toBeNull();
    expect(loaded?.guide.createdAt).toBeGreaterThan(1_600_000_000_000);
  });

  it('skips a screenshot whose image is missing from the archive', async () => {
    const bundle = makeBundle();
    bundle.images.clear();

    const loaded = await getGuide(await importGuide(bundle));
    expect(loaded?.screenshots.size).toBe(0);
    expect(loaded?.steps[0].screenshotId).toBeUndefined();
    expect(await db.screenshots.count()).toBe(0);
  });

  it('does not leave the zip entry path on the stored screenshot', async () => {
    const loaded = await getGuide(await importGuide(makeBundle()));
    const screenshot = loaded?.screenshots.get(loaded.steps[0].id) as unknown as Record<string, unknown>;
    expect(screenshot.file).toBeUndefined();
  });
});
