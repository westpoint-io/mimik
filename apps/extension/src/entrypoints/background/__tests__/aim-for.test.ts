import { describe, expect, it } from 'vitest';
import type { ElementMeta } from '@/core/guides/types';
import { aimFor } from '../aim-for';

const meta = (extra: Partial<ElementMeta>): ElementMeta =>
  ({ rect: { x: 100, y: 50, width: 40, height: 20 }, devicePixelRatio: 2, ...extra }) as ElementMeta;

describe('aimFor', () => {
  it('maps the click point into the screenshot in device pixels', () => {
    expect(aimFor(meta({ clickPoint: { x: 300, y: 150 } }), { width: 1200, height: 600 })).toEqual({
      x: 0.5,
      y: 0.5,
      aspect: 2,
    });
  });

  it('aims at the centre of the element when there was no click point', () => {
    expect(aimFor(meta({}), { width: 480, height: 240 })).toEqual({ x: 0.5, y: 0.5, aspect: 2 });
  });
});
