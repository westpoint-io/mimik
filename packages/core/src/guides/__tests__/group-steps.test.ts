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
import { getGuide, getStep, groupSteps, ungroupStep } from '../service';
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
    stepIds.map((stepId, index) =>
      makeStep({
        id: stepId,
        guideId: id,
        index,
        screenshotId: `sc-${stepId}`,
        elementMeta: {
          tag: 'input',
          cssSelector: `#input-${stepId}`,
          textContent: null,
          ariaLabel: null,
          label: null,
          placeholder: null,
          altText: null,
          name: null,
          role: null,
          href: null,
          inputType: null,
          dataTestId: null,
          rect: { x: 10 + index * 20, y: 20, width: 80, height: 30 },
          devicePixelRatio: 1,
          clickPoint: { x: 20 + index * 20, y: 30 },
        },
      }),
    ),
  );
  await db.screenshots.bulkAdd(
    stepIds.map((stepId) => ({
      id: `sc-${stepId}`,
      stepId,
      blob: new Blob(['png'], { type: 'image/png' }),
      width: 800,
      height: 600,
      mimeType: 'image/png',
    })),
  );
}

afterEach(async () => {
  await db.guides.clear();
  await db.steps.clear();
  await db.screenshots.clear();
});

describe('groupSteps', () => {
  it('combines multiple steps into one with numbered markers and sub-steps', async () => {
    await seedGuide('g1', ['s1', 's2', 's3']);

    const primaryId = await groupSteps('g1', ['s1', 's2', 's3']);
    expect(primaryId).toBe('s1');

    const res = await getGuide('g1');
    expect(res?.guide.stepIds).toEqual(['s1']);

    const primary = await getStep('s1');
    expect(primary?.groupedSteps).toHaveLength(3);
    expect(primary?.groupedSteps?.[0]?.description).toBe('s1');
    expect(primary?.groupedSteps?.[1]?.description).toBe('s2');
    expect(primary?.groupedSteps?.[2]?.description).toBe('s3');

    const shot = await db.screenshots.get('sc-s1');
    expect(shot?.edits?.annotations).toHaveLength(3);
    expect(shot?.edits?.annotations?.[0]).toMatchObject({
      type: 'marker',
      number: 1,
      x: 20,
      y: 30,
    });
    expect(shot?.edits?.annotations?.[1]).toMatchObject({
      type: 'marker',
      number: 2,
      x: 40,
      y: 30,
    });
  });

  it('refuses to group fewer than 2 steps', async () => {
    await seedGuide('g2', ['s1']);
    const result = await groupSteps('g2', ['s1']);
    expect(result).toBeNull();
  });
});

describe('ungroupStep', () => {
  it('restores grouped sub-steps into individual steps and cleans up markers', async () => {
    await seedGuide('g3', ['s1', 's2']);
    await groupSteps('g3', ['s1', 's2']);

    const ok = await ungroupStep('g3', 's1');
    expect(ok).toBe(true);

    const res = await getGuide('g3');
    expect(res?.guide.stepIds).toEqual(['s1', 's2']);

    const s1 = await getStep('s1');
    const s2 = await getStep('s2');
    expect(s1?.groupedSteps).toBeUndefined();
    expect(s2?.groupedSteps).toBeUndefined();

    const shot = await db.screenshots.get('sc-s1');
    const markers = (shot?.edits?.annotations ?? []).filter((a) => a.type === 'marker');
    expect(markers).toHaveLength(0);
  });
});
