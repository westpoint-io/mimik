import { describe, expect, it } from 'vitest';
import type { ElementMeta } from '@/core/guides/types';
import { resolveViewport } from '@/core/screenshot/geometry';
import { screenshotForElement } from '@/core/screenshot/record';

const meta: ElementMeta = {
  textContent: null,
  ariaLabel: null,
  placeholder: null,
  altText: null,
  name: null,
  role: null,
  rect: { x: 10, y: 20, width: 100, height: 40 },
  devicePixelRatio: 2,
  clickPoint: { x: 60, y: 40 },
};

const bytes = { id: 'ss-1', stepId: 'step-1', mimeType: 'image/png', width: 800, height: 600 };

describe('screenshotForElement', () => {
  it('keeps bounds in css pixels and scales the target by the pixel ratio', () => {
    const shot = screenshotForElement(bytes, meta);
    expect(shot.bounds).toEqual({ x: 10, y: 20, width: 100, height: 40 });
    expect(shot.pixelRatio).toBe(2);
    expect(shot.edits?.target).toEqual({
      x: 20,
      y: 40,
      width: 200,
      height: 80,
      border: 'dashed',
      color: '#4F46E5',
    });
  });

  it('prefers the configured target colour', () => {
    expect(screenshotForElement({ ...bytes, targetColor: '#F43F5E' }, meta).edits?.target?.color).toBe('#F43F5E');
  });

  it('only writes a cursor when one is supplied', () => {
    expect(screenshotForElement(bytes, meta).edits).not.toHaveProperty('cursor');
    expect(screenshotForElement({ ...bytes, cursor: null }, meta).edits?.cursor).toBeNull();
  });

  it('drops bounds when the target should not be zoomed to, keeping the target itself', () => {
    const shot = screenshotForElement({ ...bytes, zoomToTarget: false }, meta);
    expect(shot.bounds).toBeUndefined();
    expect(shot.edits?.target).toMatchObject({ x: 20, y: 40, width: 200, height: 80 });
    expect(resolveViewport({ ...shot, blob: new Blob() })).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });
});
