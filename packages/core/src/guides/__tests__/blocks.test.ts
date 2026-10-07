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

import { hexToRgb } from '@/core/screenshot/color';
import { actionSteps, calloutAccent, DEFAULT_CALLOUT_COLOR, stepNumbers, tint } from '../blocks';
import { db } from '../db';
import { insertBlock } from '../service';
import type { BlockType, CalloutVariant, Guide, Step } from '../types';

const HEX = /^#[0-9A-F]{6}$/;

function makeStep(overrides: Partial<Step> & { id: string }): Step {
  return {
    guideId: 'g1',
    index: 0,
    description: 'Click Save',
    action: 'click',
    url: 'https://example.com',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeBlock(id: string, blockType: BlockType, overrides?: Partial<Step>): Step {
  return makeStep({ id, action: blockType, url: '', blockType, ...overrides });
}

function makeCallout(overrides?: Partial<Step>): Step {
  return makeBlock('c1', 'callout', overrides);
}

async function seedGuide(id: string, steps: Step[]): Promise<Guide> {
  const guide: Guide = {
    id,
    title: 'Test Guide',
    createdAt: Date.now(),
    updatedAt: 100,
    stepIds: steps.map((s) => s.id),
    starred: false,
    deletedAt: null,
  };
  await db.guides.add(guide);
  await db.steps.bulkAdd(steps.map((step, index) => ({ ...step, guideId: id, index })));
  return guide;
}

async function storedSteps(guideId: string): Promise<Step[]> {
  return db.steps.where('guideId').equals(guideId).sortBy('index');
}

afterEach(async () => {
  await db.guides.clear();
  await db.steps.clear();
});

describe('stepNumbers', () => {
  it('numbers actions from 1 and skips blocks wherever they sit', () => {
    const steps = [
      makeBlock('b-first', 'heading'),
      makeStep({ id: 'a1' }),
      makeBlock('b-mid-1', 'callout'),
      makeBlock('b-mid-2', 'heading'),
      makeStep({ id: 'a2' }),
      makeStep({ id: 'a3' }),
      makeBlock('b-last', 'callout'),
    ];

    const numbers = stepNumbers(steps);

    expect([...numbers]).toEqual([
      ['a1', 1],
      ['a2', 2],
      ['a3', 3],
    ]);
    for (const id of ['b-first', 'b-mid-1', 'b-mid-2', 'b-last']) {
      expect(numbers.has(id)).toBe(false);
    }
  });

  it('numbers by position in the list, not by the stored index field', () => {
    const numbers = stepNumbers([makeStep({ id: 'a1', index: 7 }), makeStep({ id: 'a2', index: 42 })]);

    expect(numbers.get('a1')).toBe(1);
    expect(numbers.get('a2')).toBe(2);
  });

  it('returns an empty map for no steps and for blocks only', () => {
    expect(stepNumbers([]).size).toBe(0);
    expect(stepNumbers([makeBlock('b1', 'heading'), makeBlock('b2', 'callout')]).size).toBe(0);
  });
});

describe('actionSteps', () => {
  it('keeps captured actions in order and drops every block', () => {
    const a1 = makeStep({ id: 'a1' });
    const a2 = makeStep({ id: 'a2' });

    const result = actionSteps([makeBlock('b1', 'heading'), a1, makeBlock('b2', 'callout'), a2]);

    expect(result).toEqual([a1, a2]);
    expect(result[0]).toBe(a1);
  });

  it('returns everything when there are no blocks and nothing when there are only blocks', () => {
    const actions = [makeStep({ id: 'a1' }), makeStep({ id: 'a2' })];
    expect(actionSteps(actions)).toEqual(actions);
    expect(actionSteps([makeBlock('b1', 'callout')])).toEqual([]);
  });
});

describe('calloutAccent', () => {
  it('gives every preset variant its own valid accent', () => {
    const presets: CalloutVariant[] = ['info', 'warning', 'error', 'success'];
    const accents = presets.map((calloutVariant) => calloutAccent(makeCallout({ calloutVariant })));

    for (const accent of accents) expect(accent).toMatch(HEX);
    expect(new Set(accents).size).toBe(presets.length);
  });

  it('treats a callout without a variant as info', () => {
    expect(calloutAccent(makeCallout())).toBe(calloutAccent(makeCallout({ calloutVariant: 'info' })));
  });

  it('ignores calloutColor unless the variant is custom', () => {
    const accent = calloutAccent(makeCallout({ calloutVariant: 'warning', calloutColor: '#000000' }));

    expect(accent).not.toBe('#000000');
    expect(accent).toBe(calloutAccent(makeCallout({ calloutVariant: 'warning' })));
  });

  it('reads the custom colour and normalizes it', () => {
    expect(calloutAccent(makeCallout({ calloutVariant: 'custom', calloutColor: '#123456' }))).toBe('#123456');
    expect(calloutAccent(makeCallout({ calloutVariant: 'custom', calloutColor: '#abc' }))).toBe('#AABBCC');
  });

  it('falls back to the default colour on a malformed custom hex', () => {
    for (const calloutColor of ['', 'indigo', '#12345', '#1234567', 'ffffff!']) {
      expect(calloutAccent(makeCallout({ calloutVariant: 'custom', calloutColor }))).toBe(DEFAULT_CALLOUT_COLOR);
    }
    expect(calloutAccent(makeCallout({ calloutVariant: 'custom' }))).toBe(DEFAULT_CALLOUT_COLOR);
  });
});

describe('tint', () => {
  it('lightens every channel without passing white', () => {
    const source = '#4F46E5';
    const result = tint(source);

    expect(result).toMatch(HEX);
    expect(result).not.toBe(source);

    const before = hexToRgb(source)!;
    const after = hexToRgb(result)!;
    for (let i = 0; i < 3; i++) {
      expect(after[i]).toBeGreaterThan(before[i]!);
      expect(after[i]).toBeLessThanOrEqual(255);
    }
  });

  it('scales between the original colour and white', () => {
    expect(tint('#4F46E5', 1)).toBe('#4F46E5');
    expect(tint('#4F46E5', 0)).toBe('#FFFFFF');
    expect(tint('#000000', 0.12)).toBe('#E0E0E0');
  });

  it('leans further toward white as the ratio shrinks', () => {
    const light = hexToRgb(tint('#4F46E5', 0.1))!;
    const dark = hexToRgb(tint('#4F46E5', 0.5))!;

    for (let i = 0; i < 3; i++) expect(light[i]).toBeGreaterThan(dark[i]!);
  });

  it('returns white for an unparseable colour', () => {
    expect(tint('nope')).toBe('#FFFFFF');
  });
});

describe('insertBlock', () => {
  it('places the block at the requested index and re-indexes the rest contiguously', async () => {
    await seedGuide('g1', [makeStep({ id: 's1' }), makeStep({ id: 's2' }), makeStep({ id: 's3' })]);

    const blockId = await insertBlock('g1', 1, 'heading', 'Set up the account');

    const steps = await storedSteps('g1');
    expect(steps.map((s) => s.id)).toEqual(['s1', blockId, 's2', 's3']);
    expect(steps.map((s) => s.index)).toEqual([0, 1, 2, 3]);

    const guide = await db.guides.get('g1');
    expect(guide!.stepIds).toEqual(['s1', blockId, 's2', 's3']);
    expect(guide!.updatedAt).toBeGreaterThan(100);
  });

  it('stores the block text as the description and leaves capture fields empty', async () => {
    await seedGuide('g1', [makeStep({ id: 's1' })]);

    const blockId = await insertBlock('g1', 1, 'heading', 'Set up the account');

    const block = await db.steps.get(blockId);
    expect(block!.blockType).toBe('heading');
    expect(block!.description).toBe('Set up the account');
    expect(block!.url).toBe('');
    expect(block!.screenshotId).toBeUndefined();
    expect(block!.elementMeta).toBeUndefined();
    expect(block!.calloutVariant).toBeUndefined();
  });

  it('defaults a callout to the info variant', async () => {
    await seedGuide('g1', []);

    const blockId = await insertBlock('g1', 0, 'callout', 'Watch out');

    const block = await db.steps.get(blockId);
    expect(block!.calloutVariant).toBe('info');
    expect(calloutAccent(block!)).toBe(calloutAccent(makeCallout({ calloutVariant: 'info' })));
  });

  it('inserts at 0 ahead of every existing step', async () => {
    await seedGuide('g1', [makeStep({ id: 's1' }), makeStep({ id: 's2' })]);

    const blockId = await insertBlock('g1', 0, 'heading', 'Before you start');

    const steps = await storedSteps('g1');
    expect(steps.map((s) => s.id)).toEqual([blockId, 's1', 's2']);
    expect(steps.map((s) => s.index)).toEqual([0, 1, 2]);
    expect((await db.guides.get('g1'))!.stepIds).toEqual([blockId, 's1', 's2']);
  });

  it('appends when the index is past the end', async () => {
    await seedGuide('g1', [makeStep({ id: 's1' }), makeStep({ id: 's2' })]);

    const blockId = await insertBlock('g1', 99, 'callout', 'All done');

    const steps = await storedSteps('g1');
    expect(steps.map((s) => s.id)).toEqual(['s1', 's2', blockId]);
    expect(steps.map((s) => s.index)).toEqual([0, 1, 2]);
    expect((await db.guides.get('g1'))!.stepIds).toEqual(['s1', 's2', blockId]);
  });

  it('leaves the action numbering untouched once a block is in the middle', async () => {
    await seedGuide('g1', [makeStep({ id: 's1' }), makeStep({ id: 's2' }), makeStep({ id: 's3' })]);

    const blockId = await insertBlock('g1', 2, 'heading', 'Finish up');

    const steps = await storedSteps('g1');
    expect(actionSteps(steps).map((s) => s.id)).toEqual(['s1', 's2', 's3']);

    const numbers = stepNumbers(steps);
    expect(numbers.get('s1')).toBe(1);
    expect(numbers.get('s2')).toBe(2);
    expect(numbers.get('s3')).toBe(3);
    expect(numbers.has(blockId)).toBe(false);
  });
});
