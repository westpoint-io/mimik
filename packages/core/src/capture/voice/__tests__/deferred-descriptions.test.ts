import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearDeferredDescriptions,
  deferDescription,
  discardDeferred,
  takeDeferredDescription,
  takeDeferredDescriptions,
} from '../deferred-descriptions';

const jobs = new Map<string, () => Promise<void>>();
const ctx = (name: string) => {
  const job = jobs.get(name) ?? (async () => undefined);
  jobs.set(name, job);
  return job;
};

describe('takeDeferredDescriptions', () => {
  beforeEach(() => {
    clearDeferredDescriptions('g1');
    clearDeferredDescriptions('g2');
  });

  it('returns the steps narration did not cover', () => {
    deferDescription('g1', 's1', ctx('one'));
    deferDescription('g1', 's2', ctx('two'));

    const pending = takeDeferredDescriptions('g1', ['s1']);

    expect(pending.map((p) => p.stepId)).toEqual(['s2']);
  });

  it('returns every step when nothing was narrated', () => {
    deferDescription('g1', 's1', ctx('one'));
    deferDescription('g1', 's2', ctx('two'));

    expect(takeDeferredDescriptions('g1', []).map((p) => p.stepId)).toEqual(['s1', 's2']);
  });

  it('carries the description job captured at the time', () => {
    deferDescription('g1', 's1', ctx('billing'));

    expect(takeDeferredDescriptions('g1', [])[0]!.describe).toBe(ctx('billing'));
  });

  it('drains, so a second call returns nothing', () => {
    deferDescription('g1', 's1', ctx('one'));
    takeDeferredDescriptions('g1', []);

    expect(takeDeferredDescriptions('g1', [])).toEqual([]);
  });

  it('keeps guides separate', () => {
    deferDescription('g1', 's1', ctx('one'));
    deferDescription('g2', 's2', ctx('two'));

    expect(takeDeferredDescriptions('g1', []).map((p) => p.stepId)).toEqual(['s1']);
    expect(takeDeferredDescriptions('g2', []).map((p) => p.stepId)).toEqual(['s2']);
  });

  it('returns nothing for a guide that deferred nothing', () => {
    expect(takeDeferredDescriptions('g1', [])).toEqual([]);
  });
});

describe('discardDeferred', () => {
  beforeEach(() => {
    clearDeferredDescriptions('g1');
  });

  it('drops only the steps narration already covered', () => {
    deferDescription('g1', 's1', ctx('one'));
    deferDescription('g1', 's2', ctx('two'));

    discardDeferred('g1', ['s1']);

    expect(takeDeferredDescriptions('g1', []).map((p) => p.stepId)).toEqual(['s2']);
  });

  it('leaves the rest waiting for the end of the recording', () => {
    deferDescription('g1', 's1', ctx('one'));

    discardDeferred('g1', ['s2']);

    expect(takeDeferredDescriptions('g1', []).map((p) => p.stepId)).toEqual(['s1']);
  });

  it('does nothing for a guide with nothing deferred', () => {
    expect(() => discardDeferred('g1', ['s1'])).not.toThrow();
  });
});

describe('takeDeferredDescription', () => {
  it('hands back the job saved for one step', () => {
    deferDescription('g1', 's1', ctx('one'));

    expect(takeDeferredDescription('g1', 's1')).toBe(ctx('one'));
  });

  it('leaves the other steps waiting for the end of the recording', () => {
    deferDescription('g1', 's1', ctx('one'));
    deferDescription('g1', 's2', ctx('two'));
    takeDeferredDescription('g1', 's1');

    expect(takeDeferredDescriptions('g1', []).map((d) => d.stepId)).toEqual(['s2']);
  });

  it('hands back nothing for a step that was never deferred', () => {
    expect(takeDeferredDescription('g1', 'missing')).toBeUndefined();
  });

  it('hands back nothing the second time the same step is taken', () => {
    deferDescription('g1', 's1', ctx('one'));
    takeDeferredDescription('g1', 's1');

    expect(takeDeferredDescription('g1', 's1')).toBeUndefined();
  });
});
