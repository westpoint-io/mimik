import { describe, expect, it } from 'vitest';
import type { Screenshot, Step } from '@/core/guides/types';
import type { ClickTarget } from '@/core/screenshot/types';
import { stepRequiresManual } from '../manual';

const BOUNDS = { x: 10, y: 20, width: 100, height: 40 };

const step = (overrides: Partial<Step> = {}): Step => ({
  id: 's1',
  guideId: 'g1',
  index: 0,
  description: 'Click link',
  action: 'click',
  url: 'https://example.com',
  timestamp: 0,
  elementMeta: { textContent: 'Link' } as Step['elementMeta'],
  ...overrides,
});

const shot = (target: ClickTarget | null | undefined, bounds = BOUNDS, pixelRatio = 2): Screenshot =>
  ({
    id: 'sc1',
    stepId: 's1',
    blob: new Blob(),
    mimeType: 'image/webp',
    width: 400,
    height: 200,
    pixelRatio,
    bounds,
    edits: { target },
  }) as Screenshot;

const captured: ClickTarget = { x: 20, y: 40, width: 200, height: 80, border: 'dashed', color: '#4F46E5' };

describe('stepRequiresManual', () => {
  it('requires manual advance when the step has no element metadata', () => {
    expect(stepRequiresManual(step({ elementMeta: undefined }), null)).toBe(true);
  });

  it('stays automatic when there is no screenshot to inspect', () => {
    expect(stepRequiresManual(step(), null)).toBe(false);
  });

  it('stays automatic for a target still sitting on the captured element', () => {
    expect(stepRequiresManual(step(), shot(captured))).toBe(false);
  });

  it('ignores a colour or border change', () => {
    expect(stepRequiresManual(step(), shot({ ...captured, color: '#22C55E', border: 'solid' }))).toBe(false);
  });

  it('tolerates sub-pixel rounding', () => {
    expect(stepRequiresManual(step(), shot({ ...captured, x: captured.x + 0.4 }))).toBe(false);
  });

  it('stays automatic for a target only trimmed to the edge of the screenshot', () => {
    const overhanging = { x: 150, y: 20, width: 100, height: 40 };
    const trimmed: ClickTarget = { x: 300, y: 40, width: 100, height: 80, border: 'dashed', color: '#4F46E5' };
    expect(stepRequiresManual(step(), shot(trimmed, overhanging))).toBe(false);
  });

  it('requires manual advance once the target is moved', () => {
    expect(stepRequiresManual(step(), shot({ ...captured, x: captured.x + 30 }))).toBe(true);
  });

  it('requires manual advance once the target is resized', () => {
    expect(stepRequiresManual(step(), shot({ ...captured, height: captured.height + 25 }))).toBe(true);
  });

  it('requires manual advance when the target was removed or the image replaced', () => {
    expect(stepRequiresManual(step(), shot(null))).toBe(true);
  });

  it('stays automatic when the capture never recorded bounds', () => {
    const boundless = { ...shot(null) };
    boundless.bounds = undefined;
    expect(stepRequiresManual(step(), boundless)).toBe(false);
  });
});
