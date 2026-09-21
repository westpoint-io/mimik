import { describe, expect, it } from 'vitest';
import type { Step } from '@/core/guides/types';
import { isReplayable } from '../session';

const meta = (source?: 'dom' | 'uia' | 'screen' | 'ax') =>
  ({
    source,
    textContent: null,
    ariaLabel: null,
    placeholder: null,
    altText: null,
    name: null,
    role: null,
    rect: { x: 0, y: 0, width: 1, height: 1 },
    devicePixelRatio: 1,
  }) as Step['elementMeta'];

describe('isReplayable', () => {
  it('replays a DOM step, and one captured before source existed', () => {
    expect(isReplayable({ elementMeta: meta('dom') })).toBe(true);
    expect(isReplayable({ elementMeta: meta(undefined) })).toBe(true);
  });

  it('never replays a desktop step or one with no element at all', () => {
    expect(isReplayable({ elementMeta: meta('uia') })).toBe(false);
    expect(isReplayable({ elementMeta: meta('screen') })).toBe(false);
    expect(isReplayable({ elementMeta: meta('ax') })).toBe(false);
    expect(isReplayable({})).toBe(false);
  });
});
