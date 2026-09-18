// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  CURSOR_ENTRY_ORIGIN,
  cursorOriginFor,
  cursorProgress,
  cursorScale,
  easeInOut,
  FPS,
  findIdealZoomLevel,
  landingFrame,
  letterbox,
  normalizedTargetCenter,
  overlapFrames,
  reserveTooltip,
  ringProgress,
  STEP_SECONDS,
  sharpZoomCeiling,
  spannedFrames,
  stepFrames,
  stepKind,
  stepSpans,
  stepStarts,
  toFrames,
  tooltipBand,
  tooltipPlacement,
  tooltipProgress,
  totalStepFrames,
  videoChapters,
  wrapLines,
  zoomCrop,
  zoomProgress,
} from '@/core/export/video-export';
import {
  FRAME_HEIGHT,
  FRAME_WIDTH,
  RESOLUTION_SPECS,
  uniformTimeline,
  voiceTimeline,
} from '@/core/export/video-support';

const measure = (line: string) => line.length * 10;

describe('step timing', () => {
  it('holds every step for the structural 5.23 seconds', () => {
    expect(STEP_SECONDS).toBeCloseTo(5.23, 10);
  });

  it('rounds a step to 157 frames at 30 fps', () => {
    expect(FPS).toBe(30);
    expect(stepFrames()).toBe(157);
  });

  it('overlaps consecutive steps by ten frames', () => {
    expect(overlapFrames()).toBe(10);
    expect(toFrames(0.33)).toBe(10);
  });

  it('emits a single step without subtracting an overlap', () => {
    expect(totalStepFrames(1)).toBe(157);
  });

  it('subtracts one overlap per seam', () => {
    expect(totalStepFrames(2)).toBe(157 * 2 - 10);
    expect(totalStepFrames(6)).toBe(157 * 6 - 10 * 5);
    expect(totalStepFrames(6)).toBe(892);
  });

  it('returns nothing for a guide with no usable steps', () => {
    expect(totalStepFrames(0)).toBe(0);
  });
});

describe('zoomProgress', () => {
  it('stays fully zoomed out through the opening hold', () => {
    expect(zoomProgress(0)).toBe(0);
    expect(zoomProgress(44)).toBe(0);
    expect(zoomProgress(45)).toBe(0);
  });

  it('ramps across the transition window', () => {
    expect(zoomProgress(56)).toBeCloseTo(0.5, 2);
  });

  it('is fully zoomed in for the closing hold', () => {
    expect(zoomProgress(67)).toBe(1);
    expect(zoomProgress(156)).toBe(1);
  });

  it('rises monotonically', () => {
    let last = -1;
    for (let frame = 0; frame <= stepFrames(); frame++) {
      const value = zoomProgress(frame);
      expect(value).toBeGreaterThanOrEqual(last);
      last = value;
    }
  });
});

describe('easeInOut', () => {
  it('pins the endpoints exactly', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
  });

  it('passes through the midpoint', () => {
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 10);
  });

  it('is symmetric about the midpoint', () => {
    for (const d of [0.05, 0.17, 0.3, 0.45]) {
      expect(easeInOut(0.5 + d)).toBeCloseTo(1 - easeInOut(0.5 - d), 10);
    }
  });

  it('increases monotonically', () => {
    let last = -1;
    for (let i = 0; i <= 100; i++) {
      const value = easeInOut(i / 100);
      expect(value).toBeGreaterThan(last);
      last = value;
    }
  });

  it('eases in slowly and out slowly', () => {
    expect(easeInOut(0.25)).toBeLessThan(0.25);
    expect(easeInOut(0.75)).toBeGreaterThan(0.75);
  });

  it('clamps input outside the unit range', () => {
    expect(easeInOut(-2)).toBe(0);
    expect(easeInOut(4)).toBe(1);
  });
});

describe('findIdealZoomLevel', () => {
  const zoom = (rect: { x: number; y: number; width: number; height: number }) =>
    findIdealZoomLevel(rect, 3000, 2400, FRAME_WIDTH, FRAME_HEIGHT);

  it('refuses to zoom when the target already fills the frame', () => {
    expect(zoom({ x: 0, y: 0, width: 3000, height: 2400 })).toBe(1);
  });

  it('caps at the composition ceiling for a target hugging the bottom-right', () => {
    expect(zoom({ x: 2400, y: 1920, width: 60, height: 48 })).toBe(3.5);
  });

  it('zooms further on a small target than on a large one', () => {
    const small = zoom({ x: 1440, y: 1140, width: 120, height: 120 });
    const large = zoom({ x: 900, y: 720, width: 1200, height: 960 });
    expect(small).toBeGreaterThan(large);
    expect(large).toBeGreaterThanOrEqual(1);
    expect(small).toBeLessThanOrEqual(3.5);
  });

  it('never leaves the one-to-ceiling band', () => {
    for (const rect of [
      { x: 0, y: 0, width: 1, height: 1 },
      { x: 2999, y: 2399, width: 1, height: 1 },
      { x: 0, y: 0, width: 15000, height: 15000 },
      { x: 3000, y: 2400, width: 30, height: 30 },
    ]) {
      const level = zoom(rect);
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(3.5);
    }
  });

  it('will not magnify a small capture past the upscale allowance', () => {
    const pinpoint = { x: 640, y: 360, width: 8, height: 8 };
    expect(findIdealZoomLevel(pinpoint, 1280, 720, FRAME_WIDTH, FRAME_HEIGHT)).toBe(1.5);
    expect(findIdealZoomLevel(pinpoint, 2560, 1440, FRAME_WIDTH, FRAME_HEIGHT)).toBe(3);
  });
});

describe('sharpZoomCeiling', () => {
  it('allows a fixed upscale beyond one-to-one', () => {
    expect(sharpZoomCeiling(1280)).toBe(1.5);
    expect(sharpZoomCeiling(2560)).toBe(3);
  });

  it('never drops below one, however small the capture', () => {
    expect(sharpZoomCeiling(320)).toBe(1);
    expect(sharpZoomCeiling(1)).toBe(1);
  });

  it('still respects the composition ceiling on a huge capture', () => {
    expect(sharpZoomCeiling(6000)).toBe(3.5);
    expect(sharpZoomCeiling(20000)).toBe(3.5);
  });

  it('falls back to the composition ceiling for a degenerate size', () => {
    expect(sharpZoomCeiling(0)).toBe(3.5);
    expect(sharpZoomCeiling(Number.NaN)).toBe(3.5);
  });
});

describe('reveal beats', () => {
  const land = landingFrame();

  it('lands the camera on frame 67', () => {
    expect(land).toBe(67);
  });

  it('shows nothing but the page while the camera is still moving', () => {
    for (let frame = 0; frame <= land; frame++) {
      expect(ringProgress(frame)).toBe(0);
      expect(tooltipProgress(frame)).toBe(0);
    }
  });

  it('pops the ring after the camera lands, then settles', () => {
    expect(ringProgress(land + 4)).toBe(0);
    expect(ringProgress(land + 7)).toBeGreaterThan(0);
    expect(ringProgress(land + 11)).toBe(1);
  });

  it('brings the tooltip in only once the ring is fully on', () => {
    const ringDone = Array.from({ length: stepFrames() }, (_, f) => f).find((f) => ringProgress(f) === 1) as number;
    const tipStart = Array.from({ length: stepFrames() }, (_, f) => f).find((f) => tooltipProgress(f) > 0) as number;
    expect(tipStart).toBeGreaterThanOrEqual(ringDone);
  });

  it('holds ring and tooltip on for the rest of the step', () => {
    for (let frame = 90; frame < stepFrames(); frame++) {
      expect(ringProgress(frame)).toBe(1);
      expect(tooltipProgress(frame)).toBe(1);
    }
  });

  it('rises monotonically', () => {
    let ring = -1;
    let tip = -1;
    let cursor = -1;
    for (let frame = 0; frame <= stepFrames(); frame++) {
      expect(ringProgress(frame)).toBeGreaterThanOrEqual(ring);
      expect(tooltipProgress(frame)).toBeGreaterThanOrEqual(tip);
      expect(cursorProgress(frame)).toBeGreaterThanOrEqual(cursor);
      ring = ringProgress(frame);
      tip = tooltipProgress(frame);
      cursor = cursorProgress(frame);
    }
  });
});

describe('cursorProgress', () => {
  it('waits before setting off', () => {
    expect(cursorProgress(0)).toBe(0);
    expect(cursorProgress(11)).toBe(0);
  });

  it('arrives exactly as the camera lands', () => {
    expect(cursorProgress(landingFrame())).toBe(1);
    expect(cursorProgress(landingFrame() - 1)).toBeLessThan(1);
  });

  it('is halfway across at the midpoint of its travel', () => {
    expect(cursorProgress(39)).toBeCloseTo(0.5, 2);
  });

  it('stays parked on the target through the close hold', () => {
    for (let frame = landingFrame(); frame < stepFrames(); frame++) {
      expect(cursorProgress(frame)).toBe(1);
    }
  });
});

describe('reserveTooltip', () => {
  const image = { width: 3000, height: 2000 };
  const band = tooltipBand({ height: 66 });
  const reserve = (target: { x: number; y: number; width: number; height: number }) =>
    reserveTooltip(target, band, image, FRAME_HEIGHT);

  it('counts the gap and the frame padding into the reserved band', () => {
    expect(band).toBe(66 + 14 + 20);
  });

  it('grows downwards for a target in the upper half', () => {
    const target = { x: 1400, y: 300, width: 120, height: 40 };
    const reserved = reserve(target);
    expect(reserved.y).toBe(target.y);
    expect(reserved.height).toBeGreaterThan(target.height);
  });

  it('grows upwards for a target in the lower half', () => {
    const target = { x: 1400, y: 1600, width: 120, height: 40 };
    const reserved = reserve(target);
    expect(reserved.y).toBeLessThan(target.y);
    expect(reserved.y + reserved.height).toBeCloseTo(target.y + target.height, 6);
  });

  it('leaves the horizontal extent alone', () => {
    const reserved = reserve({ x: 1400, y: 300, width: 120, height: 40 });
    expect(reserved.x).toBe(1400);
    expect(reserved.width).toBe(120);
  });

  it('pulls the camera back so the tooltip has somewhere to sit', () => {
    const target = { x: 1400, y: 300, width: 120, height: 40 };
    const zoomOf = (r: typeof target) => findIdealZoomLevel(r, image.width, image.height, FRAME_WIDTH, FRAME_HEIGHT);
    expect(zoomOf(reserve(target))).toBeLessThan(zoomOf(target));
  });

  it('never reserves outside the image', () => {
    for (const target of [
      { x: 0, y: 0, width: 90, height: 60 },
      { x: 2910, y: 1940, width: 90, height: 60 },
      { x: 1400, y: 990, width: 120, height: 20 },
    ]) {
      const reserved = reserve(target);
      expect(reserved.y).toBeGreaterThanOrEqual(0);
      expect(reserved.y + reserved.height).toBeLessThanOrEqual(image.height);
      expect(reserved.height).toBeGreaterThanOrEqual(target.height);
    }
  });

  it('returns the bare target when there is nothing to reserve', () => {
    const target = { x: 1400, y: 300, width: 120, height: 40 };
    expect(reserveTooltip(target, 0, image, FRAME_HEIGHT)).toEqual(target);
    expect(reserveTooltip(target, band, image, 0)).toEqual(target);
  });
});

describe('resolution specs', () => {
  it('offers a codec level that actually covers each frame size', () => {
    expect(RESOLUTION_SPECS['720p']).toMatchObject({ width: 1280, height: 720, avc: 'avc1.64001f' });
    expect(RESOLUTION_SPECS['1080p']).toMatchObject({ width: 1920, height: 1080, avc: 'avc1.640028' });
  });

  it('keeps every frame size on the sixteen-by-nine composition', () => {
    for (const spec of Object.values(RESOLUTION_SPECS)) {
      expect(spec.width / spec.height).toBeCloseTo(FRAME_WIDTH / FRAME_HEIGHT, 6);
    }
  });

  it('demands more source pixels before zooming at the larger frame size', () => {
    expect(sharpZoomCeiling(3024, RESOLUTION_SPECS['1080p'].width)).toBeLessThan(
      sharpZoomCeiling(3024, RESOLUTION_SPECS['720p'].width),
    );
  });
});

describe('videoChapters', () => {
  const steps = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `s${i}`, description: `Do thing ${i}`, action: 'click' })) as never[];
  const stride = (157 - 10) / 30;

  it('has nothing to mark for a guide with no frames', () => {
    expect(videoChapters([], true)).toEqual([]);
  });

  it('starts the first step at zero when there is no cover', () => {
    expect(videoChapters(steps(3), false)[0].start).toBe(0);
  });

  it('pushes every step past the cover when there is one', () => {
    const marks = videoChapters(steps(3), true);
    expect(marks[0].start).toBe(3);
    expect(marks[1].start).toBeCloseTo(3 + stride, 6);
  });

  it('spaces steps by one stride, not one full step', () => {
    const marks = videoChapters(steps(4), false);
    for (let i = 1; i < marks.length; i++) {
      expect(marks[i].start - marks[i - 1].start).toBeCloseTo(stride, 6);
    }
  });

  it('runs the last chapter to the true end of the footage', () => {
    const marks = videoChapters(steps(6), true);
    expect(marks[5].end).toBeCloseTo(3 + totalStepFrames(6) / FPS, 6);
    expect(marks[5].end).toBeGreaterThan(marks[5].start);
  });

  it('leaves no gap or overlap between consecutive chapters', () => {
    const marks = videoChapters(steps(5), true);
    for (let i = 1; i < marks.length; i++) {
      expect(marks[i].start).toBeCloseTo(marks[i - 1].end, 6);
    }
  });

  it('carries the step description as the chapter title', () => {
    expect(videoChapters(steps(2), false)[1].title).toBe('Do thing 1');
  });

  it('falls back to a numbered label when a step has no description', () => {
    const bare = [{ id: 'a', description: '   ', action: 'click' }] as never[];
    expect(videoChapters(bare, false)[0].title).toBe('export.stepLabel[1]');
  });

  it('carries the action kind through to each chapter', () => {
    const mixed = [
      { id: 'a', description: 'Click save', action: 'click' },
      { id: 'b', description: 'Type a name', action: 'input' },
      { id: 'c', description: 'Press Enter', action: 'keydown:Enter' },
      { id: 'd', description: 'Open the page', action: 'navigate' },
    ] as never[];
    expect(videoChapters(mixed, false).map((c) => c.kind)).toEqual(['click', 'type', 'key', 'navigate']);
  });
});

describe('stepKind', () => {
  const step = (over: Record<string, unknown>) => over as unknown as Parameters<typeof stepKind>[0];

  it('reads typing apart from clicking', () => {
    expect(stepKind(step({ action: 'input' }))).toBe('type');
    expect(stepKind(step({ action: 'click' }))).toBe('click');
  });

  it('recognises any key press', () => {
    expect(stepKind(step({ action: 'keydown:Enter' }))).toBe('key');
    expect(stepKind(step({ action: 'keydown:Tab' }))).toBe('key');
  });

  it('marks navigation, which has no target to point at', () => {
    expect(stepKind(step({ action: 'navigate' }))).toBe('navigate');
  });

  it('treats an authored block as a note rather than an action', () => {
    expect(stepKind(step({ blockType: 'callout', action: '' }))).toBe('note');
    expect(stepKind(step({ blockType: 'heading', action: '' }))).toBe('note');
  });

  it('folds the remaining pointer actions in with clicks', () => {
    for (const action of ['auxclick', 'copy', 'paste', 'cut', 'drag', '']) {
      expect(stepKind(step({ action }))).toBe('click');
    }
  });
});

describe('cursorScale', () => {
  const capture = 1700;
  const wide = FRAME_WIDTH / 3024;
  const close = FRAME_WIDTH / (3024 / 2.4);

  it('shrinks the pointer on the wide shot and grows it as the camera closes in', () => {
    expect(cursorScale(capture, wide)).toBeLessThan(cursorScale(capture, close));
  });

  it('keeps the pointer legible at the widest framing', () => {
    expect(cursorScale(capture, wide)).toBeGreaterThanOrEqual(0.9);
  });

  it('never lets the pointer swell past the ceiling', () => {
    expect(cursorScale(capture, 12)).toBe(2.6);
    expect(cursorScale(9000, close)).toBe(2.6);
  });

  it('tracks the camera proportionally between the two limits', () => {
    const mid = cursorScale(capture, 0.7);
    expect(mid).toBeCloseTo((capture * 0.026 * 0.7) / 23, 6);
    expect(mid).toBeGreaterThan(0.9);
    expect(mid).toBeLessThan(2.6);
  });

  it('falls back to the floor for a degenerate camera', () => {
    expect(cursorScale(0, close)).toBe(0.9);
    expect(cursorScale(capture, 0)).toBe(0.9);
  });
});

describe('normalizedTargetCenter', () => {
  const shot = (over: Record<string, unknown> = {}) =>
    ({
      id: 's',
      stepId: 'p',
      guideId: 'g',
      blob: new Blob(),
      mimeType: 'image/webp',
      width: 2000,
      height: 1000,
      pixelRatio: 2,
      bounds: { x: 100, y: 200, width: 50, height: 20 },
      createdAt: 0,
      ...over,
    }) as unknown as Parameters<typeof normalizedTargetCenter>[0];

  it('reports the target centre as a fraction of the full capture', () => {
    expect(normalizedTargetCenter(shot())).toEqual({ x: 0.125, y: 0.42 });
  });

  it('measures against a deliberate crop when the step has one', () => {
    const at = normalizedTargetCenter(shot({ edits: { viewport: { x: 200, y: 400, width: 200, height: 100 } } }));
    expect(at).toEqual({ x: 0.25, y: 0.2 });
  });

  it('has no origin to offer when the step has no target', () => {
    expect(normalizedTargetCenter(shot({ bounds: undefined }))).toBeNull();
  });

  it('stays inside the frame for a target sitting outside the crop', () => {
    const at = normalizedTargetCenter(shot({ edits: { viewport: { x: 1000, y: 600, width: 400, height: 200 } } }));
    expect(at?.x).toBe(0);
    expect(at?.y).toBe(0);
  });
});

describe('zoomCrop', () => {
  const image = { width: 1000, height: 800 };
  const target = { x: 480, y: 380, width: 40, height: 40 };

  it('starts on the whole image', () => {
    expect(zoomCrop(image, target, 0)).toEqual({ x: 0, y: 0, width: 1000, height: 800 });
  });

  it('ends on a crop centred on the target', () => {
    const crop = zoomCrop(image, target, 1);
    const level = findIdealZoomLevel(target, image.width, image.height, FRAME_WIDTH, FRAME_HEIGHT);
    expect(crop.width).toBeCloseTo(image.width / level, 6);
    expect(crop.height).toBeCloseTo(image.height / level, 6);
    expect(crop.x + crop.width / 2).toBeCloseTo(target.x + target.width / 2, 6);
    expect(crop.y + crop.height / 2).toBeCloseTo(target.y + target.height / 2, 6);
  });

  it('lands halfway between the two at the midpoint', () => {
    const start = zoomCrop(image, target, 0);
    const middle = zoomCrop(image, target, 0.5);
    const end = zoomCrop(image, target, 1);
    expect(middle.width).toBeCloseTo((start.width + end.width) / 2, 6);
    expect(middle.x).toBeCloseTo((start.x + end.x) / 2, 6);
    expect(middle.width).toBeLessThan(start.width);
    expect(middle.width).toBeGreaterThan(end.width);
  });

  it('keeps the image aspect ratio at every point of the ramp', () => {
    for (let i = 0; i <= 20; i++) {
      const crop = zoomCrop(image, target, i / 20);
      expect(crop.width / crop.height).toBeCloseTo(image.width / image.height, 6);
    }
  });

  it('never samples outside the image', () => {
    const corners = [
      { x: 0, y: 0, width: 30, height: 20 },
      { x: 970, y: 780, width: 30, height: 20 },
      { x: 0, y: 780, width: 30, height: 20 },
      { x: 970, y: 0, width: 30, height: 20 },
      { x: 480, y: 380, width: 40, height: 40 },
    ];
    for (const rect of corners) {
      for (let i = 0; i <= 20; i++) {
        const crop = zoomCrop(image, rect, i / 20);
        expect(crop.x).toBeGreaterThanOrEqual(0);
        expect(crop.y).toBeGreaterThanOrEqual(0);
        expect(crop.x + crop.width).toBeLessThanOrEqual(image.width + 1e-9);
        expect(crop.y + crop.height).toBeLessThanOrEqual(image.height + 1e-9);
      }
    }
  });

  it('holds the full frame for a step with no target', () => {
    for (const t of [0, 0.5, 1]) {
      expect(zoomCrop(image, null, t)).toEqual({ x: 0, y: 0, width: 1000, height: 800 });
    }
  });

  it('holds the full frame when the ideal zoom is already one', () => {
    const filling = { x: 0, y: 0, width: 1000, height: 800 };
    expect(zoomCrop(image, filling, 1)).toEqual({ x: 0, y: 0, width: 1000, height: 800 });
  });
});

describe('letterbox', () => {
  it('centres a 16:10 capture inside a 16:9 frame with bars top and bottom', () => {
    const fit = letterbox(1280, 800, FRAME_WIDTH, FRAME_HEIGHT);
    expect(fit.width).toBe(1152);
    expect(fit.height).toBe(720);
    expect(fit.y).toBe(0);
    expect(fit.x).toBeCloseTo(64);
  });

  it('fills exactly when the aspect ratio already matches', () => {
    const fit = letterbox(1920, 1080, FRAME_WIDTH, FRAME_HEIGHT);
    expect(fit).toMatchObject({ width: 1280, height: 720, x: 0, y: 0 });
  });

  it('scales up a small capture instead of leaving it tiny', () => {
    expect(letterbox(640, 360, FRAME_WIDTH, FRAME_HEIGHT).scale).toBe(2);
  });

  it('preserves aspect ratio', () => {
    const fit = letterbox(3000, 1000, FRAME_WIDTH, FRAME_HEIGHT);
    expect(fit.width / fit.height).toBeCloseTo(3, 5);
  });
});

describe('wrapLines', () => {
  it('keeps a short description on one line', () => {
    expect(wrapLines('Click on branquias', 300, measure)).toEqual(['Click on branquias']);
  });

  it('wraps onto the next line when the current one overflows', () => {
    expect(wrapLines('aaa bbb ccc', 70, measure)).toEqual(['aaa bbb', 'ccc']);
  });

  it('truncates with an ellipsis at the line cap', () => {
    const lines = wrapLines('aaa bbb ccc ddd eee fff', 30, measure, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });

  it('does not ellipsize when everything fits inside the cap', () => {
    expect(wrapLines('aaa bbb', 30, measure, 2).join(' ')).not.toContain('…');
  });

  it('returns nothing for blank text', () => {
    expect(wrapLines('   ', 300, measure)).toEqual([]);
  });
});

describe('tooltipPlacement', () => {
  const tooltip = { width: 400, height: 80 };

  it('sits below the target when there is room', () => {
    const at = tooltipPlacement({ x: 500, y: 200, width: 120, height: 40 }, tooltip);
    expect(at.below).toBe(true);
    expect(at.y).toBeGreaterThan(240);
  });

  it('flips above the target when below would overflow the frame', () => {
    const at = tooltipPlacement({ x: 500, y: 660, width: 120, height: 40 }, tooltip);
    expect(at.below).toBe(false);
    expect(at.y).toBeLessThan(660);
  });

  it('centres horizontally on the target', () => {
    const at = tooltipPlacement({ x: 440, y: 200, width: 400, height: 40 }, tooltip);
    expect(at.x).toBeCloseTo(440);
  });

  it('clamps to the left edge for a target near x=0', () => {
    const at = tooltipPlacement({ x: 0, y: 200, width: 40, height: 40 }, tooltip);
    expect(at.x).toBe(20);
  });

  it('clamps to the right edge for a target near the frame width', () => {
    const at = tooltipPlacement({ x: FRAME_WIDTH - 40, y: 200, width: 40, height: 40 }, tooltip);
    expect(at.x).toBe(FRAME_WIDTH - tooltip.width - 20);
  });

  it('keeps the tooltip inside the frame even when the target is offscreen low', () => {
    const at = tooltipPlacement({ x: 500, y: FRAME_HEIGHT, width: 0, height: 0 }, tooltip);
    expect(at.y).toBeGreaterThanOrEqual(20);
    expect(at.y + tooltip.height).toBeLessThanOrEqual(FRAME_HEIGHT - 20);
  });
});

describe('cursorOriginFor', () => {
  const at = (targets: Record<number, { x: number; y: number }>) => (i: number) => targets[i] ?? null;

  it('starts from the previous frame target', () => {
    expect(cursorOriginFor(1, at({ 0: { x: 0.2, y: 0.3 } }))).toEqual({ x: 0.2, y: 0.3 });
  });

  it('skips earlier frames that have no target', () => {
    expect(cursorOriginFor(2, at({ 0: { x: 0.1, y: 0.9 } }))).toEqual({ x: 0.1, y: 0.9 });
  });

  it('falls back to the entry origin on the first frame', () => {
    expect(cursorOriginFor(0, at({}))).toEqual(CURSOR_ENTRY_ORIGIN);
  });

  it('falls back to the entry origin when no earlier frame has a target', () => {
    expect(cursorOriginFor(3, at({}))).toEqual(CURSOR_ENTRY_ORIGIN);
  });

  it('places the entry origin below the frame so the cursor travels in', () => {
    expect(CURSOR_ENTRY_ORIGIN.y).toBeGreaterThan(1);
  });
});

describe('narrated step spans', () => {
  it('matches the uniform layout when nothing was narrated', () => {
    const spans = stepSpans(uniformTimeline(4), 4);
    expect(spans).toEqual([157, 157, 157, 157]);
    expect(stepStarts(spans)).toEqual([0, 147, 294, 441]);
    expect(spannedFrames(spans)).toBe(totalStepFrames(4));
  });

  it('never runs a step shorter than the animation, whatever the timeline claims', () => {
    expect(stepSpans({ coverSeconds: 3, stepSeconds: [0.1, 1] }, 2)).toEqual([157, 157]);
  });

  it('pushes later steps back by exactly what a long narration added', () => {
    const spans = stepSpans(voiceTimeline(3, new Map([[0, 8]])), 3);
    expect(spans[0]).toBe(toFrames(0.35 + 8 + 0.6));
    expect(stepStarts(spans)).toEqual([0, spans[0] - 10, spans[0] - 10 + 147]);
    expect(spannedFrames(spans)).toBe(spans[0] + 157 * 2 - 10 * 2);
  });

  it('holds the last step for its full span', () => {
    const spans = stepSpans(voiceTimeline(2, new Map([[1, 9]])), 2);
    expect(spannedFrames(spans)).toBe(157 - 10 + spans[1]);
  });
});

describe('videoChapters on a narrated timeline', () => {
  const steps = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `s${i}`, description: `Do thing ${i}`, action: 'click' }) as never);

  it('opens the first chapter after the stretched cover card', () => {
    const timeline = voiceTimeline(2, new Map([[-1, 6]]));
    expect(videoChapters(steps(2), true, FPS, timeline)[0].start).toBeCloseTo(timeline.coverSeconds, 6);
  });

  it('gives a narrated step the longer chapter', () => {
    const marks = videoChapters(steps(3), false, FPS, voiceTimeline(3, new Map([[1, 8]])));
    expect(marks[1].end - marks[1].start).toBeGreaterThan(marks[0].end - marks[0].start);
    expect(marks[2].start).toBeCloseTo(marks[1].end, 6);
  });

  it('is unchanged for a guide with no narration', () => {
    expect(videoChapters(steps(4), true, FPS, uniformTimeline(4))).toEqual(videoChapters(steps(4), true));
  });
});
