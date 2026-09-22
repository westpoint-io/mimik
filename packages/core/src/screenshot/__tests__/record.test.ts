import { describe, expect, it } from 'vitest';
import type { ElementMeta } from '@/core/guides/types';
import { resolveViewport } from '@/core/screenshot/geometry';
import { autoZoom, clickZoomViewport, screenshotForElement, snapZoom } from '@/core/screenshot/record';

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

describe('snapZoom', () => {
  it('snaps to quarter steps between 1 and 5', () => {
    expect(snapZoom(2.19)).toBe(2.25);
    expect(snapZoom(1.02)).toBe(1);
    expect(snapZoom(0.4)).toBe(1);
    expect(snapZoom(9)).toBe(5);
    expect(snapZoom(3.37)).toBe(3.25);
  });
});

describe('autoZoom', () => {
  it('picks the level that renders content the same size whatever the capture', () => {
    expect(autoZoom(2560, 1.5)).toBe(2.25);
    expect(autoZoom(1200, 1.5)).toBe(1);
    expect(autoZoom(800, 1)).toBe(1);
    expect(autoZoom(3840, 2)).toBe(2.5);
  });
});

describe('clickZoomViewport', () => {
  it('divides the frame by the zoom level', () => {
    const big = clickZoomViewport(2560, 1440, { x: 1280, y: 720 }, 2.25);
    expect(big.width).toBeCloseTo(1137.8, 1);
    expect(big.height).toBeCloseTo(640, 1);
  });

  it('shows the whole frame at 1x and clamps a level past the range', () => {
    expect(clickZoomViewport(1200, 800, { x: 600, y: 400 }, 1)).toEqual({ x: 0, y: 0, width: 1200, height: 800 });
    expect(clickZoomViewport(1200, 800, { x: 600, y: 400 }, 9).width).toBe(240);
  });

  it('centres on the click and stays inside the frame', () => {
    expect(clickZoomViewport(2560, 1440, { x: 1600, y: 900 }, 2)).toMatchObject({ x: 960, y: 540 });
    expect(clickZoomViewport(2560, 1440, { x: 10, y: 10 }, 2)).toMatchObject({ x: 0, y: 0 });
    expect(clickZoomViewport(2560, 1440, { x: 2550, y: 1430 }, 2)).toMatchObject({ x: 1280, y: 720 });
  });
});
