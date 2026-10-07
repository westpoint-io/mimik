import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { broadcasts } = vi.hoisted(() => {
  const broadcasts: unknown[] = [];
  globalThis.BroadcastChannel = class BroadcastChannel {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    postMessage(message: unknown) {
      broadcasts.push(message);
    }
    addEventListener() {}
    removeEventListener() {}
    close() {}
    onmessage = null;
    onmessageerror = null;
    dispatchEvent() {
      return true;
    }
  } as unknown as typeof BroadcastChannel;
  return { broadcasts };
});

import { db } from '../db';
import {
  createSnapshot,
  deleteScreenshot,
  deleteStep,
  deleteSteps,
  getGuide,
  getSnapshots,
  permanentlyDeleteGuide,
  renameSnapshot,
  reorderSteps,
  replaceScreenshot,
  revertToSnapshot,
  softDeleteGuide,
  toggleStar,
  updateGuideTitle,
  updateStepDescription,
} from '../service';
import type { Guide, Screenshot, Step } from '../types';

function makeStep(overrides: Partial<Step> & { id: string; guideId: string }): Step {
  return {
    index: 0,
    description: 'Test step',
    action: 'click',
    url: 'https://example.com',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeScreenshot(overrides: Partial<Screenshot> & { id: string; stepId: string }): Screenshot {
  return {
    blob: new Blob(['img'], { type: 'image/png' }),
    mimeType: 'image/png',
    width: 800,
    height: 600,
    ...overrides,
  };
}

async function seedGuide(id: string, extras?: Partial<Guide>): Promise<Guide> {
  const guide: Guide = {
    id,
    title: 'Test Guide',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stepIds: [],
    starred: false,
    deletedAt: null,
    ...extras,
  };
  await db.guides.add(guide);
  return guide;
}

afterEach(async () => {
  await db.guides.clear();
  await db.steps.clear();
  await db.screenshots.clear();
  await db.snapshots.clear();
});

describe('createSnapshot', () => {
  it('stores the guide, steps and screenshot rows without blobs', async () => {
    await seedGuide('g1', { stepIds: ['s1'], title: 'Original' });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc1' }));
    await db.screenshots.add(makeScreenshot({ id: 'sc1', stepId: 's1' }));

    const snapshot = await createSnapshot('g1');

    expect(snapshot).not.toBeNull();
    expect(snapshot?.title).toBe('Original');
    expect(snapshot?.stepIds).toEqual(['s1']);
    expect(snapshot?.steps).toHaveLength(1);
    expect(snapshot?.screenshots).toHaveLength(1);
    expect(snapshot?.screenshots[0]).not.toHaveProperty('blob');
    expect(snapshot?.contentHash).toBeTypeOf('string');
  });

  it('returns null for a guide that does not exist', async () => {
    expect(await createSnapshot('missing')).toBeNull();
  });

  it('orders steps by index, not insertion order', async () => {
    await seedGuide('g1', { stepIds: ['s2', 's1'] });
    await db.steps.add(makeStep({ id: 's2', guideId: 'g1', index: 1, description: 'Second' }));
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', index: 0, description: 'First' }));

    const snapshot = await createSnapshot('g1');

    expect(snapshot?.steps.map((s) => s.description)).toEqual(['First', 'Second']);
    expect(snapshot?.stepIds).toEqual(['s1', 's2']);
  });

  it('gives unchanged content the same hash and changed content a different one', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', description: 'Before' }));

    const first = await createSnapshot('g1');
    const unchanged = await createSnapshot('g1');
    expect(unchanged?.contentHash).toBe(first?.contentHash);

    await updateStepDescription('s1', 'After');
    const changed = await createSnapshot('g1');
    expect(changed?.contentHash).not.toBe(first?.contentHash);
  });

  it('keeps createdAt strictly increasing within a guide', async () => {
    await seedGuide('g1', { stepIds: [] });

    const a = await createSnapshot('g1');
    const b = await createSnapshot('g1');
    const c = await createSnapshot('g1');

    expect(b!.createdAt).toBeGreaterThan(a!.createdAt);
    expect(c!.createdAt).toBeGreaterThan(b!.createdAt);
    expect((await getSnapshots('g1')).map((s) => s.id)).toEqual([c!.id, b!.id, a!.id]);
  });
});

describe('getSnapshots', () => {
  it('returns snapshots for the guide, newest first', async () => {
    await seedGuide('g1', { stepIds: [] });
    await db.snapshots.bulkAdd([
      {
        id: 'n1',
        guideId: 'g1',
        createdAt: 100,
        contentHash: 'a',
        title: 'A',
        stepIds: [],
        steps: [],
        screenshots: [],
      },
      {
        id: 'n2',
        guideId: 'g1',
        createdAt: 300,
        contentHash: 'b',
        title: 'B',
        stepIds: [],
        steps: [],
        screenshots: [],
      },
      {
        id: 'n3',
        guideId: 'g2',
        createdAt: 200,
        contentHash: 'c',
        title: 'C',
        stepIds: [],
        steps: [],
        screenshots: [],
      },
    ]);

    const list = await getSnapshots('g1');

    expect(list.map((s) => s.id)).toEqual(['n2', 'n1']);
  });
});

describe('renameSnapshot', () => {
  it('stores a name on the snapshot without a schema migration', async () => {
    await seedGuide('g1', { stepIds: [] });
    const snapshot = await createSnapshot('g1');

    await renameSnapshot(snapshot!.id, 'before rewrite');

    expect((await db.snapshots.get(snapshot!.id))?.name).toBe('before rewrite');
    expect((await getSnapshots('g1'))[0].name).toBe('before rewrite');
  });

  it('trims surrounding whitespace', async () => {
    await seedGuide('g1', { stepIds: [] });
    const snapshot = await createSnapshot('g1');

    await renameSnapshot(snapshot!.id, '   spaced out  ');

    expect((await db.snapshots.get(snapshot!.id))?.name).toBe('spaced out');
  });

  it('clears the name when given an empty or whitespace-only value', async () => {
    await seedGuide('g1', { stepIds: [] });
    const snapshot = await createSnapshot('g1');
    await renameSnapshot(snapshot!.id, 'named');

    await renameSnapshot(snapshot!.id, '   ');

    expect((await db.snapshots.get(snapshot!.id))?.name).toBeUndefined();
  });

  it('leaves createdAt and contentHash untouched', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1' }));
    const snapshot = await createSnapshot('g1');

    await renameSnapshot(snapshot!.id, 'milestone');

    const stored = await db.snapshots.get(snapshot!.id);
    expect(stored?.createdAt).toBe(snapshot!.createdAt);
    expect(stored?.contentHash).toBe(snapshot!.contentHash);
  });

  it('keeps the content hash out of naming, so a named version still groups with unchanged siblings', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1' }));
    const first = await createSnapshot('g1');

    await renameSnapshot(first!.id, 'checkpoint');
    const second = await createSnapshot('g1');

    expect(second?.contentHash).toBe(first?.contentHash);
    expect(second?.name).toBeUndefined();
  });

  it('does not rename other snapshots or touch the guide', async () => {
    await seedGuide('g1', { stepIds: [], updatedAt: 5000 });
    const first = await createSnapshot('g1');
    const second = await createSnapshot('g1');
    await db.guides.update('g1', { updatedAt: 5000 });
    broadcasts.length = 0;

    await renameSnapshot(second!.id, 'only this one');

    expect((await db.snapshots.get(first!.id))?.name).toBeUndefined();
    expect((await db.guides.get('g1'))?.updatedAt).toBe(5000);
    expect(broadcasts.filter((m) => !!m && typeof m === 'object' && 'type' in m)).toEqual([]);
  });

  it('is a no-op for an unknown snapshot id', async () => {
    await expect(renameSnapshot('missing', 'ghost')).resolves.toBeUndefined();
  });
});

describe('revertToSnapshot', () => {
  it('restores title, step order and step content', async () => {
    await seedGuide('g1', { stepIds: ['s1', 's2'], title: 'Original' });
    await db.steps.bulkAdd([
      makeStep({ id: 's1', guideId: 'g1', index: 0, description: 'First' }),
      makeStep({ id: 's2', guideId: 'g1', index: 1, description: 'Second' }),
    ]);
    const snapshot = await createSnapshot('g1');

    await updateGuideTitle('g1', 'Changed');
    await updateStepDescription('s1', 'Edited');
    await deleteStep('g1', 's2');

    await revertToSnapshot(snapshot!.id);

    const restored = await getGuide('g1');
    expect(restored?.guide.title).toBe('Original');
    expect(restored?.guide.stepIds).toEqual(['s1', 's2']);
    expect(restored?.steps.map((s) => s.description)).toEqual(['First', 'Second']);
  });

  it('restores step order after a reorder', async () => {
    await seedGuide('g1', { stepIds: ['s3', 's1', 's2'] });
    await db.steps.bulkAdd([
      makeStep({ id: 's1', guideId: 'g1', index: 1, description: 'Middle' }),
      makeStep({ id: 's2', guideId: 'g1', index: 2, description: 'Last' }),
      makeStep({ id: 's3', guideId: 'g1', index: 0, description: 'First' }),
    ]);
    const snapshot = await createSnapshot('g1');

    await reorderSteps('g1', ['s1', 's2', 's3']);

    await revertToSnapshot(snapshot!.id);

    const restored = await getGuide('g1');
    expect(restored?.steps.map((s) => s.description)).toEqual(['First', 'Middle', 'Last']);
    expect(restored?.guide.stepIds).toEqual(['s3', 's1', 's2']);
  });

  it('removes steps added after the snapshot was taken', async () => {
    await seedGuide('g1', { stepIds: ['s1'], title: 'Original' });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', index: 0, description: 'First' }));
    const snapshot = await createSnapshot('g1');

    await db.steps.add(makeStep({ id: 's2', guideId: 'g1', index: 1, description: 'Added later' }));
    await db.guides.update('g1', { stepIds: ['s1', 's2'] });

    await revertToSnapshot(snapshot!.id);

    const restored = await getGuide('g1');
    expect(restored?.guide.stepIds).toEqual(['s1']);
    expect(restored?.steps.map((s) => s.description)).toEqual(['First']);
    expect(await db.steps.get('s2')).toBeUndefined();
  });

  it('snapshots the current state before restoring, so restore is undoable', async () => {
    await seedGuide('g1', { stepIds: [], title: 'Original' });
    const first = await createSnapshot('g1');
    await updateGuideTitle('g1', 'Changed');

    const undo = await revertToSnapshot(first!.id);

    const list = await getSnapshots('g1');
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe('Changed');
    expect(undo?.id).toBe(list[0].id);
    expect(undo?.title).toBe('Changed');

    await revertToSnapshot(undo!.id);
    expect((await db.guides.get('g1'))?.title).toBe('Changed');
  });

  it('does not un-star or un-trash the guide', async () => {
    await seedGuide('g1', { stepIds: [], starred: false, deletedAt: null });
    const snapshot = await createSnapshot('g1');
    await toggleStar('g1');
    await softDeleteGuide('g1');

    await revertToSnapshot(snapshot!.id);

    const guide = await db.guides.get('g1');
    expect(guide?.starred).toBe(true);
    expect(guide?.deletedAt).not.toBeNull();
  });

  it('restores screenshot metadata onto the live blob and bumps updatedAt', async () => {
    await seedGuide('g1', { stepIds: ['s1'], updatedAt: 1000 });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc1' }));
    await db.screenshots.add(
      makeScreenshot({
        id: 'sc1',
        stepId: 's1',
        width: 800,
        edits: {
          alt: 'original caption',
          annotations: [{ id: 'a1', type: 'redact', x: 1, y: 2, w: 3, h: 4, style: 'blur' }],
        },
      }),
    );
    const snapshot = await createSnapshot('g1');

    await db.screenshots.update('sc1', {
      width: 1234,
      edits: { alt: 'edited caption', annotations: [] },
      blob: new Blob(['edited'], { type: 'image/png' }),
    });

    const undo = await revertToSnapshot(snapshot!.id);

    expect(undo).not.toBeNull();
    const restored = await db.screenshots.get('sc1');
    expect(restored?.width).toBe(800);
    expect(restored?.edits).toEqual({
      alt: 'original caption',
      annotations: [{ id: 'a1', type: 'redact', x: 1, y: 2, w: 3, h: 4, style: 'blur' }],
    });
    expect(await restored?.blob?.text()).toBe('edited');
    expect((await db.guides.get('g1'))?.updatedAt).toBeGreaterThan(1000);
  });

  it('is a no-op for an unknown snapshot id', async () => {
    await seedGuide('g1', { stepIds: [], title: 'Original' });
    broadcasts.length = 0;
    expect(await revertToSnapshot('missing')).toBeNull();
    expect((await db.guides.get('g1'))?.title).toBe('Original');
    expect(broadcasts).toEqual([]);
  });

  it('writes nothing and returns null when the guide no longer exists', async () => {
    await seedGuide('g1', { stepIds: ['s1'], title: 'Original' });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc1' }));
    await db.screenshots.add(makeScreenshot({ id: 'sc1', stepId: 's1' }));
    const snapshot = await createSnapshot('g1');

    await db.guides.delete('g1');
    await db.steps.clear();
    await db.screenshots.clear();
    broadcasts.length = 0;

    expect(await revertToSnapshot(snapshot!.id)).toBeNull();
    expect(broadcasts).toEqual([]);
    expect(await db.steps.count()).toBe(0);
    expect(await db.screenshots.count()).toBe(0);
    expect(await db.guides.count()).toBe(0);
    expect(await getSnapshots('g1')).toHaveLength(1);
  });
});

describe('append-only screenshots', () => {
  it('replaceScreenshot keeps the old row and repoints the step', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc1' }));
    await db.screenshots.add(makeScreenshot({ id: 'sc1', stepId: 's1' }));

    const newId = await replaceScreenshot('s1', new Blob(['new'], { type: 'image/webp' }), {
      width: 100,
      height: 50,
    });

    expect(newId).not.toBe('sc1');
    expect(await db.screenshots.get('sc1')).toBeDefined();
    expect((await db.steps.get('s1'))?.screenshotId).toBe(newId);
  });

  it('deleteScreenshot clears the pointer but keeps the row', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc1' }));
    await db.screenshots.add(makeScreenshot({ id: 'sc1', stepId: 's1' }));

    await deleteScreenshot('s1');

    expect((await db.steps.get('s1'))?.screenshotId).toBeUndefined();
    expect(await db.screenshots.get('sc1')).toBeDefined();
  });

  it('deleteStep keeps the screenshot row', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc1' }));
    await db.screenshots.add(makeScreenshot({ id: 'sc1', stepId: 's1' }));
    await createSnapshot('g1');

    await deleteStep('g1', 's1');

    expect(await db.screenshots.get('sc1')).toBeDefined();
  });

  it('deleteSteps keeps the screenshot row of every deleted step', async () => {
    await seedGuide('g1', { stepIds: ['s1', 's2'] });
    await db.steps.bulkAdd([
      makeStep({ id: 's1', guideId: 'g1', index: 0, screenshotId: 'sc1' }),
      makeStep({ id: 's2', guideId: 'g1', index: 1, screenshotId: 'sc2' }),
    ]);
    await db.screenshots.bulkAdd([
      makeScreenshot({ id: 'sc1', stepId: 's1' }),
      makeScreenshot({ id: 'sc2', stepId: 's2' }),
    ]);
    await createSnapshot('g1');

    await deleteSteps('g1', ['s1', 's2']);

    expect(await db.screenshots.count()).toBe(2);
  });

  it('permanentlyDeleteGuide sweeps unreferenced rows and snapshots', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc2' }));
    await db.screenshots.bulkAdd([
      makeScreenshot({ id: 'sc1', stepId: 's1' }),
      makeScreenshot({ id: 'sc2', stepId: 's1' }),
    ]);
    await createSnapshot('g1');

    await permanentlyDeleteGuide('g1');

    expect(await db.screenshots.count()).toBe(0);
    expect(await db.snapshots.count()).toBe(0);
    expect(await db.steps.count()).toBe(0);
  });

  it('restores the previous image after a replace', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc1' }));
    await db.screenshots.add(makeScreenshot({ id: 'sc1', stepId: 's1' }));
    const snapshot = await createSnapshot('g1');

    await replaceScreenshot('s1', new Blob(['new'], { type: 'image/webp' }), { width: 100, height: 50 });
    await revertToSnapshot(snapshot!.id);

    expect((await db.steps.get('s1'))?.screenshotId).toBe('sc1');
    expect(await (await db.screenshots.get('sc1'))?.blob?.text()).toBe('img');
  });

  it('restores a deleted image', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc1' }));
    await db.screenshots.add(makeScreenshot({ id: 'sc1', stepId: 's1' }));
    const snapshot = await createSnapshot('g1');

    await deleteScreenshot('s1');
    await revertToSnapshot(snapshot!.id);

    expect((await db.steps.get('s1'))?.screenshotId).toBe('sc1');
    const restored = await getGuide('g1');
    expect(restored?.screenshots.get('s1')?.id).toBe('sc1');
    expect(await restored?.screenshots.get('s1')?.blob.text()).toBe('img');
  });

  it('sweeps screenshot rows orphaned by a step deletion', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc1' }));
    await db.screenshots.add(makeScreenshot({ id: 'sc1', stepId: 's1' }));
    await createSnapshot('g1');

    await deleteStep('g1', 's1');
    await permanentlyDeleteGuide('g1');

    expect(await db.screenshots.count()).toBe(0);
  });

  it('sweeps rows added after the snapshot once their step is deleted', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc1' }));
    await db.screenshots.add(makeScreenshot({ id: 'sc1', stepId: 's1' }));
    await createSnapshot('g1');

    await replaceScreenshot('s1', new Blob(['new'], { type: 'image/webp' }), { width: 10, height: 10 });
    await deleteStep('g1', 's1');
    await permanentlyDeleteGuide('g1');

    expect(await db.screenshots.count()).toBe(0);
  });

  it('drops the screenshot row when a step is deleted before any snapshot exists', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc1' }));
    await db.screenshots.add(makeScreenshot({ id: 'sc1', stepId: 's1' }));

    await deleteStep('g1', 's1');

    expect(await db.screenshots.count()).toBe(0);
  });
});
