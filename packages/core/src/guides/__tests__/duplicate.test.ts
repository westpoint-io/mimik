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
import { createSnapshot, duplicateGuide, getGuide, getSnapshots, replaceScreenshot } from '../service';
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
  await db.transcripts.clear();
  broadcasts.length = 0;
});

describe('duplicateGuide', () => {
  it('returns null for a guide that does not exist', async () => {
    expect(await duplicateGuide('missing')).toBeNull();
  });

  it('copies steps and screenshots under fresh ids', async () => {
    await seedGuide('g1', { stepIds: ['s1', 's2'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', index: 0, screenshotId: 'sc1' }));
    await db.steps.add(makeStep({ id: 's2', guideId: 'g1', index: 1, screenshotId: 'sc2' }));
    await db.screenshots.bulkAdd([
      makeScreenshot({ id: 'sc1', stepId: 's1' }),
      makeScreenshot({ id: 'sc2', stepId: 's2' }),
    ]);

    const copyId = await duplicateGuide('g1');
    expect(copyId).not.toBeNull();
    expect(copyId).not.toBe('g1');

    const copy = await getGuide(copyId!);
    expect(copy?.steps).toHaveLength(2);
    expect(copy?.steps.map((s) => s.id)).not.toContain('s1');
    expect(copy?.steps.map((s) => s.index)).toEqual([0, 1]);
    expect(copy?.guide.stepIds).toEqual(copy?.steps.map((s) => s.id));
    expect(copy?.steps.every((s) => s.guideId === copyId)).toBe(true);

    const copiedIds = copy?.steps.map((s) => s.screenshotId);
    expect(copiedIds).not.toContain('sc1');
    expect(copiedIds).not.toContain('sc2');
    expect(copy?.screenshots.size).toBe(2);
  });

  it('leaves the source guide untouched', async () => {
    await seedGuide('g1', { stepIds: ['s1'], title: 'Original' });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc1' }));
    await db.screenshots.add(makeScreenshot({ id: 'sc1', stepId: 's1' }));

    await duplicateGuide('g1');

    const source = await getGuide('g1');
    expect(source?.guide.title).toBe('Original');
    expect(source?.guide.stepIds).toEqual(['s1']);
    expect(source?.steps[0].screenshotId).toBe('sc1');
  });

  it('gives the copy screenshot rows of its own so edits do not leak between guides', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc1' }));
    await db.screenshots.add(makeScreenshot({ id: 'sc1', stepId: 's1' }));

    const copyId = await duplicateGuide('g1');
    const copy = await getGuide(copyId!);
    const copiedRow = copy!.screenshots.get(copy!.steps[0].id)!;

    await db.screenshots.update(copiedRow.id, { edits: { alt: 'edited in the copy only' } });

    expect((await db.screenshots.get('sc1'))?.edits).toBeUndefined();
  });

  it('starts the copy with no version history of its own', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc1' }));
    await db.screenshots.add(makeScreenshot({ id: 'sc1', stepId: 's1' }));
    await createSnapshot('g1');

    const copyId = await duplicateGuide('g1');

    expect(await getSnapshots(copyId!)).toHaveLength(0);
    expect(await getSnapshots('g1')).toHaveLength(1);
  });

  it('does not carry the transcript over', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', narratedDescription: 'what I said' }));
    await db.transcripts.add({
      id: 't1',
      guideId: 'g1',
      epochMs: Date.now(),
      lines: [{ text: 'what I said', startSeconds: 0, endSeconds: 1, stepId: 's1' }],
    } as never);

    const copyId = await duplicateGuide('g1');

    expect(await db.transcripts.where('guideId').equals(copyId!).count()).toBe(0);
    const copy = await getGuide(copyId!);
    expect(copy?.steps[0].narratedDescription).toBe('what I said');
  });

  it('copies only the screenshot each step currently points at', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc1' }));
    await db.screenshots.add(makeScreenshot({ id: 'sc1', stepId: 's1' }));
    await replaceScreenshot('s1', new Blob(['new'], { type: 'image/png' }), { width: 10, height: 10 });
    expect(await db.screenshots.where('stepId').equals('s1').count()).toBe(2);

    const copyId = await duplicateGuide('g1');
    const copy = await getGuide(copyId!);

    expect(await db.screenshots.where('stepId').equals(copy!.steps[0].id).count()).toBe(1);
  });

  it('does not inherit starred, trashed or staging state', async () => {
    await seedGuide('g1', { stepIds: [], starred: true, deletedAt: 123, staging: true });

    const copyId = await duplicateGuide('g1');
    const copy = await db.guides.get(copyId!);

    expect(copy?.starred).toBe(false);
    expect(copy?.deletedAt).toBeNull();
    expect(copy?.staging).toBeUndefined();
  });

  it('clears the pending-AI flag, which nothing would ever resolve on the copy', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', aiPending: true }));

    const copyId = await duplicateGuide('g1');
    const copy = await getGuide(copyId!);

    expect(copy?.steps[0].aiPending).toBeUndefined();
    expect((await db.steps.get('s1'))?.aiPending).toBe(true);
  });

  it('drops a screenshot row that names no step of this guide rather than copying it unkeyed', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', screenshotId: 'sc1' }));
    await db.screenshots.add(makeScreenshot({ id: 'sc1', stepId: 'gone' }));

    const copyId = await duplicateGuide('g1');
    const copy = await getGuide(copyId!);

    expect(copy?.steps).toHaveLength(1);
    expect(copy?.steps[0].screenshotId).toBeUndefined();
    expect(copy?.screenshots.size).toBe(0);
    expect(await db.screenshots.count()).toBe(1);
  });

  it('announces the new guide on the guides channel', async () => {
    await seedGuide('g1', { stepIds: [] });
    await duplicateGuide('g1');
    expect(broadcasts).toContainEqual({ type: 'mutated' });
  });
});
