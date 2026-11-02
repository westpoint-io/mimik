import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.BroadcastChannel = class BroadcastChannel {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    postMessage() {}
    addEventListener() {}
    removeEventListener() {}
    close() {}
    onmessage = null;
    onmessageerror = null;
    dispatchEvent() {
      return true;
    }
  } as unknown as typeof BroadcastChannel;
});

import { db } from '../db';
import { copySteps, deleteTranscripts, getGuide, getTranscripts } from '../service';
import type { Guide, Step } from '../types';

function makeStep(overrides: Partial<Step> & { id: string; guideId: string }): Step {
  return {
    index: 0,
    description: overrides.id,
    action: 'click',
    url: 'https://example.com',
    timestamp: 1,
    ...overrides,
  };
}

async function seedGuide(id: string, stepIds: string[], extras?: Partial<Guide>): Promise<void> {
  await db.guides.add({
    id,
    title: `Guide ${id}`,
    createdAt: 1,
    updatedAt: 1,
    stepIds,
    starred: false,
    deletedAt: null,
    ...extras,
  });
  await db.steps.bulkAdd(
    stepIds.map((stepId, index) => makeStep({ id: stepId, guideId: id, index, screenshotId: `sc-${stepId}` })),
  );
  await db.screenshots.bulkAdd(
    stepIds.map((stepId) => ({
      id: `sc-${stepId}`,
      stepId,
      blob: new Blob(['img'], { type: 'image/png' }),
      mimeType: 'image/png',
      width: 800,
      height: 600,
      edits: { zoomLevel: 2, alt: 'Billing button' },
    })),
  );
}

afterEach(async () => {
  await db.guides.clear();
  await db.steps.clear();
  await db.screenshots.clear();
  await db.transcripts.clear();
});

describe('copySteps', () => {
  it('appends copies of the selected steps to another guide in their current order', async () => {
    await seedGuide('src', ['a', 'b', 'c']);
    await seedGuide('dst', ['x']);

    const result = await copySteps('src', ['c', 'a'], 'dst');

    const target = (await getGuide('dst'))!;
    expect(result?.guideId).toBe('dst');
    expect(target.steps.map((step) => step.description)).toEqual(['x', 'a', 'c']);
    expect(target.steps.map((step) => step.index)).toEqual([0, 1, 2]);
    expect(target.guide.stepIds).toEqual(target.steps.map((step) => step.id));
    expect(result?.stepIds).toEqual(target.guide.stepIds.slice(1));
    expect(result?.stepIds).not.toContain('a');
  });

  it('makes a new guide holding only the copies when no guide is chosen', async () => {
    await seedGuide('src', ['a', 'b']);

    const result = (await copySteps('src', ['b'], null))!;

    const created = (await getGuide(result.guideId))!;
    expect(result.guideId).not.toBe('src');
    expect(created.guide.title).toContain('Guide src');
    expect(created.steps.map((step) => step.description)).toEqual(['b']);
    expect(created.guide.stepIds).toEqual(result.stepIds);
  });

  it('brings screenshots and their edits under fresh ids and leaves the source alone', async () => {
    await seedGuide('src', ['a']);
    await seedGuide('dst', []);

    const result = (await copySteps('src', ['a'], 'dst'))!;

    const copy = (await getGuide('dst'))!;
    const shot = copy.screenshots.get(result.stepIds[0]!);
    expect(copy.steps[0]!.screenshotId).not.toBe('sc-a');
    expect(shot?.edits).toEqual({ zoomLevel: 2, alt: 'Billing button' });
    const source = (await getGuide('src'))!;
    expect(source.guide.stepIds).toEqual(['a']);
    expect(source.steps[0]!.screenshotId).toBe('sc-a');
  });

  it('carries the spoken lines of the copied steps so the target can still delete them', async () => {
    await seedGuide('src', ['a', 'b']);
    await seedGuide('dst', []);
    await db.steps.update('a', { description: 'Open billing', narratedDescription: 'Open billing' });
    await db.transcripts.add({
      id: 't1',
      guideId: 'src',
      epochMs: 1,
      createdAt: 1,
      lines: [
        { start: 0, end: 1, text: 'Open billing', stepId: 'a', rejectReason: null },
        { start: 1, end: 2, text: 'Other words', stepId: 'b', rejectReason: null },
      ],
    });

    const result = (await copySteps('src', ['a'], 'dst'))!;

    const [row] = await getTranscripts('dst');
    expect(row!.lines).toEqual([expect.objectContaining({ text: 'Open billing', stepId: result.stepIds[0] })]);
    await deleteTranscripts('dst');
    expect((await getGuide('dst'))!.steps[0]!.narratedDescription).toBeUndefined();
    expect(await getTranscripts('src')).toHaveLength(1);
  });

  it('copies nothing when the target guide is missing or in the trash', async () => {
    await seedGuide('src', ['a']);
    await seedGuide('gone', [], { deletedAt: 5 });

    expect(await copySteps('src', ['a'], 'missing')).toBeNull();
    expect(await copySteps('src', ['a'], 'gone')).toBeNull();
    expect(await db.steps.count()).toBe(1);
  });
});
