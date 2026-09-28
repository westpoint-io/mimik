import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { broadcastMessages } = vi.hoisted(() => {
  const broadcastMessages: Array<unknown> = [];

  globalThis.BroadcastChannel = class BroadcastChannel {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    postMessage(data: unknown) {
      broadcastMessages.push(data);
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

  return { broadcastMessages };
});

import { db } from '../db';
import {
  addStepToGuide,
  createGuide,
  deleteStep,
  deleteSteps,
  getGuide,
  getGuides,
  getStarredGuides,
  getTrashedGuides,
  permanentlyDeleteGuide,
  reorderSteps,
  softDeleteGuide,
  toggleStar,
  updateGuideDescription,
  updateGuideTitle,
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

beforeEach(async () => {
  broadcastMessages.length = 0;
});

afterEach(async () => {
  await db.guides.clear();
  await db.steps.clear();
  await db.screenshots.clear();
  await db.snapshots.clear();
});

describe('createGuide', () => {
  it('creates a guide with correct defaults', async () => {
    const guide = await createGuide('g1');

    expect(guide.id).toBe('g1');
    expect(guide.title).toBe('fullview.untitledGuide');
    expect(guide.stepIds).toEqual([]);
    expect(guide.starred).toBe(false);
    expect(guide.deletedAt).toBeNull();
    expect(guide.createdAt).toBeTypeOf('number');
    expect(guide.updatedAt).toBeTypeOf('number');

    const stored = await db.guides.get('g1');
    expect(stored).toEqual(guide);
  });
});

describe('getGuide', () => {
  it('returns guide with steps and screenshots', async () => {
    await seedGuide('g1', { stepIds: ['s1', 's2'] });
    const step1 = makeStep({ id: 's1', guideId: 'g1', index: 0, screenshotId: 'sc1' });
    const step2 = makeStep({ id: 's2', guideId: 'g1', index: 1, screenshotId: 'sc2' });
    await db.steps.bulkAdd([step1, step2]);
    const sc1 = makeScreenshot({ id: 'sc1', stepId: 's1' });
    const sc2 = makeScreenshot({ id: 'sc2', stepId: 's2' });
    await db.screenshots.bulkAdd([sc1, sc2]);

    const result = await getGuide('g1');

    expect(result).not.toBeNull();
    expect(result!.guide.id).toBe('g1');
    expect(result!.steps).toHaveLength(2);
    expect(result!.steps[0].id).toBe('s1');
    expect(result!.steps[1].id).toBe('s2');
    expect(result!.screenshots.size).toBe(2);
    expect(result!.screenshots.get('s1')).toBeDefined();
    expect(result!.screenshots.get('s2')).toBeDefined();
  });

  it('returns null for non-existent guide', async () => {
    const result = await getGuide('nope');
    expect(result).toBeNull();
  });
});

describe('addStepToGuide', () => {
  it('appends stepId and updates timestamp', async () => {
    const guide = await seedGuide('g1');
    const beforeUpdate = guide.updatedAt;

    await addStepToGuide('g1', 's1');

    const updated = await db.guides.get('g1');
    expect(updated!.stepIds).toEqual(['s1']);
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(beforeUpdate);

    await addStepToGuide('g1', 's2');
    const updated2 = await db.guides.get('g1');
    expect(updated2!.stepIds).toEqual(['s1', 's2']);
  });
});

describe('deleteStep', () => {
  it('removes step, re-indexes remaining, drops the screenshot row when there is no history', async () => {
    await seedGuide('g1', { stepIds: ['s1', 's2', 's3'] });
    await db.steps.bulkAdd([
      makeStep({ id: 's1', guideId: 'g1', index: 0, screenshotId: 'sc1' }),
      makeStep({ id: 's2', guideId: 'g1', index: 1 }),
      makeStep({ id: 's3', guideId: 'g1', index: 2 }),
    ]);
    await db.screenshots.add(makeScreenshot({ id: 'sc1', stepId: 's1' }));

    await deleteStep('g1', 's1');

    expect(await db.steps.get('s1')).toBeUndefined();
    expect(await db.screenshots.get('sc1')).toBeUndefined();

    const guide = await db.guides.get('g1');
    expect(guide!.stepIds).toEqual(['s2', 's3']);

    const remaining = await db.steps.where('guideId').equals('g1').sortBy('index');
    expect(remaining[0].index).toBe(0);
    expect(remaining[1].index).toBe(1);
  });
});

describe('deleteSteps', () => {
  it('removes a non-contiguous selection including blocks and re-indexes once', async () => {
    await seedGuide('g1', { stepIds: ['s1', 'b1', 's2', 's3', 'b2'] });
    await db.steps.bulkAdd([
      makeStep({ id: 's1', guideId: 'g1', index: 0, screenshotId: 'sc1' }),
      makeStep({ id: 'b1', guideId: 'g1', index: 1, blockType: 'heading' }),
      makeStep({ id: 's2', guideId: 'g1', index: 2, screenshotId: 'sc2' }),
      makeStep({ id: 's3', guideId: 'g1', index: 3 }),
      makeStep({ id: 'b2', guideId: 'g1', index: 4, blockType: 'callout' }),
    ]);
    await db.screenshots.bulkAdd([
      makeScreenshot({ id: 'sc1', stepId: 's1' }),
      makeScreenshot({ id: 'sc2', stepId: 's2' }),
    ]);

    await deleteSteps('g1', ['s1', 's2', 'b2']);

    const guide = await db.guides.get('g1');
    expect(guide!.stepIds).toEqual(['b1', 's3']);

    const remaining = await db.steps.where('guideId').equals('g1').sortBy('index');
    expect(remaining.map((s) => s.id)).toEqual(['b1', 's3']);
    expect(remaining.map((s) => s.index)).toEqual([0, 1]);
    expect(await db.screenshots.count()).toBe(0);
  });

  it('leaves the guide untouched when nothing is selected', async () => {
    await seedGuide('g1', { stepIds: ['s1'] });
    await db.steps.add(makeStep({ id: 's1', guideId: 'g1', index: 0 }));

    await deleteSteps('g1', []);

    expect(await db.steps.count()).toBe(1);
    expect((await db.guides.get('g1'))!.stepIds).toEqual(['s1']);
  });
});

describe('reorderSteps', () => {
  it('reassigns indices correctly', async () => {
    await seedGuide('g1', { stepIds: ['s1', 's2', 's3'] });
    await db.steps.bulkAdd([
      makeStep({ id: 's1', guideId: 'g1', index: 0 }),
      makeStep({ id: 's2', guideId: 'g1', index: 1 }),
      makeStep({ id: 's3', guideId: 'g1', index: 2 }),
    ]);

    await reorderSteps('g1', ['s3', 's1', 's2']);

    const guide = await db.guides.get('g1');
    expect(guide!.stepIds).toEqual(['s3', 's1', 's2']);

    const steps = await db.steps.where('guideId').equals('g1').sortBy('index');
    expect(steps.map((s) => s.id)).toEqual(['s3', 's1', 's2']);
    expect(steps.map((s) => s.index)).toEqual([0, 1, 2]);
  });
});

describe('toggleStar', () => {
  it('toggles starred boolean and broadcasts change', async () => {
    await seedGuide('g1');

    const result1 = await toggleStar('g1');
    expect(result1).toBe(true);
    expect((await db.guides.get('g1'))!.starred).toBe(true);
    expect(broadcastMessages).toContainEqual({ type: 'starred', id: 'g1', starred: true });

    broadcastMessages.length = 0;
    const result2 = await toggleStar('g1');
    expect(result2).toBe(false);
    expect((await db.guides.get('g1'))!.starred).toBe(false);
    expect(broadcastMessages).toContainEqual({ type: 'starred', id: 'g1', starred: false });
  });

  it('returns false for non-existent guide', async () => {
    const result = await toggleStar('nope');
    expect(result).toBe(false);
  });
});

describe('softDeleteGuide', () => {
  it('sets deletedAt and broadcasts mutated', async () => {
    await seedGuide('g1');

    await softDeleteGuide('g1');

    const guide = await db.guides.get('g1');
    expect(guide!.deletedAt).toBeTypeOf('number');
    expect(guide!.deletedAt).not.toBeNull();
    expect(broadcastMessages).toContainEqual({ type: 'mutated' });
  });
});

describe('permanentlyDeleteGuide', () => {
  it('cascade deletes steps and screenshots', async () => {
    await seedGuide('g1', { stepIds: ['s1', 's2'] });
    await db.steps.bulkAdd([
      makeStep({ id: 's1', guideId: 'g1', index: 0, screenshotId: 'sc1' }),
      makeStep({ id: 's2', guideId: 'g1', index: 1, screenshotId: 'sc2' }),
    ]);
    await db.screenshots.bulkAdd([
      makeScreenshot({ id: 'sc1', stepId: 's1' }),
      makeScreenshot({ id: 'sc2', stepId: 's2' }),
    ]);

    await permanentlyDeleteGuide('g1');

    expect(await db.guides.get('g1')).toBeUndefined();
    expect(await db.steps.where('guideId').equals('g1').count()).toBe(0);
    expect(await db.screenshots.get('sc1')).toBeUndefined();
    expect(await db.screenshots.get('sc2')).toBeUndefined();
    expect(broadcastMessages).toContainEqual({ type: 'mutated' });
  });
});

describe('getGuides', () => {
  it('excludes trashed guides and orders by updatedAt desc', async () => {
    await seedGuide('g1', { updatedAt: 100 });
    await seedGuide('g2', { updatedAt: 300 });
    await seedGuide('g3', { updatedAt: 200, deletedAt: Date.now() });

    const guides = await getGuides();

    expect(guides.map((g) => g.id)).toEqual(['g2', 'g1']);
  });
});

describe('getStarredGuides', () => {
  it('only returns starred guides, excludes trashed', async () => {
    await seedGuide('g1', { starred: true, updatedAt: 200 });
    await seedGuide('g2', { starred: false, updatedAt: 300 });
    await seedGuide('g3', { starred: true, updatedAt: 100, deletedAt: Date.now() });

    const guides = await getStarredGuides();

    expect(guides.map((g) => g.id)).toEqual(['g1']);
  });
});

describe('getTrashedGuides', () => {
  it('only returns trashed guides', async () => {
    await seedGuide('g1', { deletedAt: null });
    await seedGuide('g2', { deletedAt: Date.now(), updatedAt: 200 });
    await seedGuide('g3', { deletedAt: Date.now(), updatedAt: 300 });

    const guides = await getTrashedGuides();

    expect(guides.map((g) => g.id)).toEqual(['g3', 'g2']);
  });
});

describe('updateGuideTitle', () => {
  it('collapses a multi-line title into one line before storing it', async () => {
    await seedGuide('g-title', { updatedAt: 100 });

    await updateGuideTitle('g-title', 'Set up\nyour profile');

    const updated = await db.guides.get('g-title');
    expect(updated!.title).toBe('Set up your profile');
    expect(updated!.updatedAt).toBeGreaterThan(100);
    expect(broadcastMessages).toContainEqual({ type: 'mutated' });
  });

  it('trims surrounding whitespace', async () => {
    await seedGuide('g-title-trim');
    await updateGuideTitle('g-title-trim', '  Set up your profile  ');
    expect((await db.guides.get('g-title-trim'))!.title).toBe('Set up your profile');
  });
});

describe('updateGuideDescription', () => {
  it('stores the description, bumps updatedAt and broadcasts mutated', async () => {
    await seedGuide('g-desc', { updatedAt: 100 });

    await updateGuideDescription('g-desc', 'Reset a locked-out user password.');

    const updated = await db.guides.get('g-desc');
    expect(updated!.description).toBe('Reset a locked-out user password.');
    expect(updated!.updatedAt).toBeGreaterThan(100);
    expect(broadcastMessages).toContainEqual({ type: 'mutated' });
  });

  it('leaves description undefined on a freshly created guide', async () => {
    await createGuide('g-fresh');
    const stored = await db.guides.get('g-fresh');
    expect(stored!.description).toBeUndefined();
  });
});
