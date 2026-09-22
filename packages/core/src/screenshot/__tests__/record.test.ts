import { describe, expect, it } from 'vitest';
import type { ElementMeta } from '@/core/guides/types';
import { resolveViewport } from '@/core/screenshot/geometry';
import { clickZoomViewport, screenshotForElement } from '@/core/screenshot/record';

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

  it('zooms to the click instead of the element, keeping the target itself', () => {
    const shot = screenshotForElement({ ...bytes, zoom: 'click' }, meta);
    expect(shot.bounds).toBeUndefined();
    expect(shot.edits?.target).toMatchObject({ x: 20, y: 40, width: 200, height: 80 });
    expect(resolveViewport({ ...shot, blob: new Blob() })).toEqual(shot.edits?.viewport);
  });

  it('writes no viewport at all when zoom is off', () => {
    const shot = screenshotForElement({ ...bytes, zoom: 'none' }, meta);
    expect(shot.bounds).toBeUndefined();
    expect(shot.edits?.viewport).toBeUndefined();
    expect(resolveViewport({ ...shot, blob: new Blob() })).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });
});

describe('clickZoomViewport', () => {
  it('zooms a large screen but never past what its pixels support', () => {
    const big = clickZoomViewport(2560, 1440, { x: 1280, y: 720 });
    expect(big.width).toBe(1408);
    expect(big.height).toBe(792);
    expect(2560 / big.width).toBeCloseTo(1.82, 2);
  });

  it('barely zooms a window-sized frame and not at all a small one', () => {
    expect(clickZoomViewport(1200, 800, { x: 600, y: 400 }).width).toBe(1100);
    expect(clickZoomViewport(800, 600, { x: 400, y: 300 })).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });

  it('centres on the click and stays inside the frame', () => {
    expect(clickZoomViewport(2560, 1440, { x: 1600, y: 900 })).toMatchObject({ x: 896, y: 504 });
    expect(clickZoomViewport(2560, 1440, { x: 10, y: 10 })).toMatchObject({ x: 0, y: 0 });
    expect(clickZoomViewport(2560, 1440, { x: 2550, y: 1430 })).toMatchObject({ x: 1152, y: 648 });
  });
});
