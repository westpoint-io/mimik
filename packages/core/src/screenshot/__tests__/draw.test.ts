import { describe, expect, it } from 'vitest';
import {
  BLUR_MARGIN,
  type Ctx,
  drawAnnotation,
  drawRoundedRect,
  TARGET_RADIUS,
  TARGET_STROKE,
} from '@/core/screenshot/draw';
import { type Annotation, DEFAULT_LINE_HEIGHT, FONT_FAMILIES, LINE_WIDTHS } from '@/core/screenshot/types';

interface Call {
  m: string;
  a: unknown[];
}

const TRACKED = [
  'lineWidth',
  'strokeStyle',
  'fillStyle',
  'lineCap',
  'lineJoin',
  'font',
  'filter',
  'imageSmoothingEnabled',
];

const METHODS = [
  'beginPath',
  'closePath',
  'moveTo',
  'lineTo',
  'arcTo',
  'arc',
  'rect',
  'clip',
  'ellipse',
  'stroke',
  'fill',
  'fillRect',
  'fillText',
  'drawImage',
  'save',
  'restore',
  'translate',
  'rotate',
  'setLineDash',
];

function recorder() {
  const calls: Call[] = [];
  const state: Record<string, unknown> = {};
  const ctx: Record<string, unknown> = { canvas: { width: 800, height: 600 } };

  for (const m of METHODS) {
    ctx[m] = (...a: unknown[]) => {
      calls.push({ m, a });
    };
  }
  for (const p of TRACKED) {
    Object.defineProperty(ctx, p, {
      get: () => state[p],
      set: (v: unknown) => {
        state[p] = v;
        calls.push({ m: `set:${p}`, a: [v] });
      },
    });
  }

  return {
    ctx: ctx as unknown as Ctx,
    calls,
    names: () => calls.map((c) => c.m),
    first: (m: string) => calls.find((c) => c.m === m)?.a,
    all: (m: string) => calls.filter((c) => c.m === m).map((c) => c.a),
    count: (m: string) => calls.filter((c) => c.m === m).length,
  };
}

describe('drawRoundedRect', () => {
  it('emits a closed path of four corner arcs', () => {
    const r = recorder();
    drawRoundedRect(r.ctx, 10, 20, 100, 50, 8);

    expect(r.names()).toEqual(['beginPath', 'moveTo', 'arcTo', 'arcTo', 'arcTo', 'arcTo', 'closePath']);
    expect(r.first('moveTo')).toEqual([18, 20]);
    expect(r.all('arcTo')[0]).toEqual([110, 20, 110, 70, 8]);
  });
});

describe('drawAnnotation redact', () => {
  it('paints an opaque rectangle for a solid redaction', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { id: 'r1', type: 'redact', style: 'solid', x: 40, y: 50, w: 120, h: 30 }, 0, 0);

    expect(r.first('set:fillStyle')).toEqual(['#1E1B4B']);
    expect(r.first('fillRect')).toEqual([40, 50, 120, 30]);
    expect(r.count('drawImage')).toBe(0);
  });

  it('clips everything it draws to the box', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { id: 'r2', type: 'redact', style: 'blur', x: 40, y: 50, w: 120, h: 30 }, 0, 0);

    expect(r.first('rect')).toEqual([40, 50, 120, 30]);
    expect(r.names().indexOf('clip')).toBeLessThan(r.names().indexOf('drawImage'));
    expect(r.count('fillRect')).toBe(0);
  });

  it('lays a coarse copy under the blur, so nothing sharp shows where the blur thins out', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { id: 'r2', type: 'redact', style: 'blur', x: 40, y: 50, w: 120, h: 30 }, 0, 0);

    const [down, up] = r.all('drawImage') as number[][];
    expect(down.slice(1)).toEqual([40, 50, 120, 30, 40, 50, 15, 4]);
    expect(up.slice(1)).toEqual([40, 50, 15, 4, 40, 50, 120, 30]);
    const draws = r.names().flatMap((name, index) => (name === 'drawImage' ? [index] : []));
    expect(r.names().indexOf('set:filter')).toBeGreaterThan(draws[1]);
  });

  it('blurs the pixels around the box too, so its edges do not fade to the original', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { id: 'r2', type: 'redact', style: 'blur', x: 40, y: 50, w: 120, h: 30 }, 0, 0);

    expect(r.first('set:filter')).toEqual(['blur(12px)']);
    const m = BLUR_MARGIN;
    const w = 120 + 2 * m;
    const h = 30 + 2 * m;
    expect(r.all('drawImage').at(-1)?.slice(1)).toEqual([40 - m, 50 - m, w, h, 40 - m, 50 - m, w, h]);
  });

  it('covers the visible part of a box that starts past the edge of a crop', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { id: 'r7', type: 'redact', style: 'blur', x: 90, y: 130, w: 120, h: 20 }, 100, 100);

    const [down, up] = r.all('drawImage') as number[][];
    expect(down.slice(1, 5)).toEqual([0, 30, 110, 20]);
    expect(down.slice(5, 7)).toEqual([100, 130]);
    expect(up.slice(5)).toEqual([100, 130, 110, 20]);
  });

  it('draws nothing for a box entirely outside the canvas', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { id: 'r8', type: 'redact', style: 'blur', x: -500, y: 10, w: 50, h: 20 }, 0, 0);

    expect(r.count('drawImage')).toBe(0);
  });

  it('keeps the padded blur source inside the canvas', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { id: 'r6', type: 'redact', style: 'blur', x: 5, y: 580, w: 50, h: 20 }, 0, 0);

    const [, sx, sy, sw, sh] = r.all('drawImage').at(-1) as number[];
    expect([sx, sy]).toEqual([0, 580 - BLUR_MARGIN]);
    expect(sx + sw).toBe(55 + BLUR_MARGIN);
    expect(sy + sh).toBe(600);
  });

  it('offsets the blur source by the viewport origin so a cropped export blurs the same pixels', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { id: 'r3', type: 'redact', style: 'blur', x: 300, y: 220, w: 80, h: 40 }, 100, 60);

    expect(r.first('rect')).toEqual([300, 220, 80, 40]);
    expect(r.names().indexOf('set:imageSmoothingEnabled')).toBeLessThan(r.names().indexOf('drawImage'));
    const [down, up] = r.all('drawImage') as number[][];
    expect(down.slice(1, 5)).toEqual([200, 160, 80, 40]);
    expect(down.slice(5, 7)).toEqual([300, 220]);
    expect(up.slice(1, 5)).toEqual([200, 160, 10, 5]);
    expect(up.slice(5)).toEqual([300, 220, 80, 40]);
    const [, sx, sy, , , dx, dy] = r.all('drawImage').at(-1) as number[];
    expect([sx, sy]).toEqual([200 - BLUR_MARGIN, 160 - BLUR_MARGIN]);
    expect([dx, dy]).toEqual([300 - BLUR_MARGIN, 220 - BLUR_MARGIN]);
  });

  it('leaves the origin out of a solid redaction, which is drawn in destination space', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { id: 'r4', type: 'redact', style: 'solid', x: 300, y: 220, w: 80, h: 40 }, 100, 60);

    expect(r.first('fillRect')).toEqual([300, 220, 80, 40]);
  });

  it('balances save and restore so a redaction cannot leak its filter onto later annotations', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { id: 'r5', type: 'redact', style: 'blur', x: 0, y: 0, w: 10, h: 10 }, 0, 0);

    expect(r.count('save')).toBe(1);
    expect(r.count('restore')).toBe(1);
    expect(r.names().at(0)).toBe('save');
    expect(r.names().at(-1)).toBe('restore');
  });
});

describe('drawAnnotation box', () => {
  const base = { id: 'b', type: 'box', x: 5, y: 6, w: 70, h: 40, color: '#EF4444' } as const;

  it('strokes without filling when the fill is transparent', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { ...base, fill: 'transparent' }, 0, 0);

    expect(r.count('fill')).toBe(0);
    expect(r.count('stroke')).toBe(1);
    expect(r.first('set:strokeStyle')).toEqual(['#EF4444']);
  });

  it('fills and strokes when a fill colour is set', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { ...base, fill: '#FACC15' }, 0, 0);

    expect(r.first('set:fillStyle')).toEqual(['#FACC15']);
    expect(r.count('fill')).toBe(1);
    expect(r.count('stroke')).toBe(1);
  });

  it('skips the stroke when the line width is none', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { ...base, lineWidth: 'none', fill: '#FACC15' }, 0, 0);

    expect(r.count('fill')).toBe(1);
    expect(r.count('stroke')).toBe(0);
  });

  it('defaults the line width to ms', () => {
    const r = recorder();
    drawAnnotation(r.ctx, base, 0, 0);

    expect(r.first('set:lineWidth')).toEqual([LINE_WIDTHS.ms]);
  });

  it('honours an explicit corner radius', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { ...base, radius: 14 }, 0, 0);

    expect(r.first('moveTo')).toEqual([base.x + 14, base.y]);
  });
});

describe('drawAnnotation ellipse', () => {
  it('centres the ellipse in its bounding box and uses absolute radii', () => {
    const r = recorder();
    drawAnnotation(
      r.ctx,
      { id: 'e', type: 'ellipse', x: 10, y: 20, w: -60, h: 40, color: '#22C55E', fill: 'transparent' },
      0,
      0,
    );

    expect(r.first('ellipse')).toEqual([-20, 40, 30, 20, 0, 0, Math.PI * 2]);
    expect(r.count('fill')).toBe(0);
    expect(r.count('stroke')).toBe(1);
  });

  it('fills before stroking when given a fill', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { id: 'e', type: 'ellipse', x: 0, y: 0, w: 10, h: 10, color: '#000', fill: '#FFF' }, 0, 0);

    expect(r.names().indexOf('fill')).toBeLessThan(r.names().indexOf('stroke'));
  });
});

describe('drawAnnotation target', () => {
  const base = { id: 't', type: 'target', x: 12, y: 14, w: 200, h: 90, color: '#4F46E5' } as const;

  it('dashes the outline when the border is dashed', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { ...base, border: 'dashed' }, 0, 0);

    expect(r.first('setLineDash')).toEqual([[8, 5]]);
    expect(r.first('set:lineWidth')).toEqual([TARGET_STROKE]);
    expect(r.first('moveTo')).toEqual([base.x + TARGET_RADIUS, base.y]);
  });

  it('leaves the outline solid when the border is solid', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { ...base, border: 'solid' }, 0, 0);

    expect(r.count('setLineDash')).toBe(0);
    expect(r.count('stroke')).toBe(1);
  });
});

describe('drawAnnotation arrow', () => {
  const base = { id: 'a', type: 'arrow', x1: 0, y1: 0, x2: 100, y2: 0, color: '#2563EB' } as const;

  it('draws the shaft between both points', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { ...base, end: 'none' }, 0, 0);

    expect(r.first('moveTo')).toEqual([0, 0]);
    expect(r.first('lineTo')).toEqual([100, 0]);
    expect(r.count('translate')).toBe(0);
  });

  it('rotates the head to the shaft angle', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { ...base, x2: 0, y2: 100, end: 'arrow' }, 0, 0);

    expect(r.first('translate')).toEqual([0, 100]);
    expect(r.first('rotate')).toEqual([Math.PI / 2]);
  });

  it.each([
    ['bar', { stroke: 1, fill: 0 }],
    ['arrow', { stroke: 1, fill: 0 }],
    ['arrow-solid', { stroke: 0, fill: 1 }],
    ['circle', { stroke: 1, fill: 0 }],
    ['circle-solid', { stroke: 0, fill: 1 }],
    ['square', { stroke: 1, fill: 0 }],
    ['square-solid', { stroke: 0, fill: 1 }],
  ] as const)('renders the %s head', (end, expected) => {
    const r = recorder();
    drawAnnotation(r.ctx, { ...base, end }, 0, 0);

    expect(r.count('stroke') - 1).toBe(expected.stroke);
    expect(r.count('fill')).toBe(expected.fill);
  });

  it('defaults to a solid arrow head', () => {
    const r = recorder();
    drawAnnotation(r.ctx, base, 0, 0);

    expect(r.count('fill')).toBe(1);
  });
});

describe('drawAnnotation text', () => {
  const base = { id: 'x', type: 'text', x: 20, y: 40, text: 'Hello', color: '#000', size: 32 } as const;

  it('writes one line at the anchor', () => {
    const r = recorder();
    drawAnnotation(r.ctx, base, 0, 0);

    expect(r.all('fillText')).toEqual([['Hello', 20, 40]]);
  });

  it('stacks each newline by the line height', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { ...base, text: 'a\nb\nc' }, 0, 0);

    const step = 32 * DEFAULT_LINE_HEIGHT;
    expect(r.all('fillText')).toEqual([
      ['a', 20, 40],
      ['b', 20, 40 + step],
      ['c', 20, 40 + 2 * step],
    ]);
  });

  it('honours an explicit line height', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { ...base, text: 'a\nb', lineHeight: 2 }, 0, 0);

    expect(r.all('fillText')[1]).toEqual(['b', 20, 40 + 64]);
  });

  it('composes weight, slant and family into the font string', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { ...base, bold: true, italic: true, fontFamily: 'serif' }, 0, 0);

    expect(r.first('set:font')).toEqual([`italic 700 32px ${FONT_FAMILIES.serif}`]);
  });

  it('defaults to medium weight, upright, sans-serif', () => {
    const r = recorder();
    drawAnnotation(r.ctx, base, 0, 0);

    expect(r.first('set:font')).toEqual([`500 32px ${FONT_FAMILIES['sans-serif']}`]);
  });
});

describe('drawAnnotation freehand', () => {
  it('traces every point pair in order', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { id: 'f', type: 'freehand', points: [1, 2, 3, 4, 5, 6], color: '#EC4899' }, 0, 0);

    expect(r.first('moveTo')).toEqual([1, 2]);
    expect(r.all('lineTo')).toEqual([
      [3, 4],
      [5, 6],
    ]);
  });

  it('defaults the stroke to md and rounds the joins', () => {
    const r = recorder();
    drawAnnotation(r.ctx, { id: 'f', type: 'freehand', points: [0, 0, 1, 1], color: '#000' }, 0, 0);

    expect(r.first('set:lineWidth')).toEqual([LINE_WIDTHS.md]);
    expect(r.first('set:lineJoin')).toEqual(['round']);
    expect(r.first('set:lineCap')).toEqual(['round']);
  });
});

describe('drawAnnotation state isolation', () => {
  const each: Annotation[] = [
    { id: '1', type: 'box', x: 0, y: 0, w: 1, h: 1, color: '#000' },
    { id: '2', type: 'ellipse', x: 0, y: 0, w: 1, h: 1, color: '#000' },
    { id: '3', type: 'target', x: 0, y: 0, w: 1, h: 1, color: '#000', border: 'dashed' },
    { id: '4', type: 'arrow', x1: 0, y1: 0, x2: 1, y2: 1, color: '#000' },
    { id: '5', type: 'text', x: 0, y: 0, text: 'a', color: '#000', size: 12 },
    { id: '6', type: 'freehand', points: [0, 0, 1, 1], color: '#000' },
    { id: '7', type: 'redact', x: 0, y: 0, w: 1, h: 1, style: 'solid' },
    { id: '8', type: 'redact', x: 0, y: 0, w: 1, h: 1, style: 'blur' },
  ];

  it.each(each.map((a) => [`${a.type}:${a.id}`, a] as const))('balances save and restore for %s', (_label, a) => {
    const r = recorder();
    drawAnnotation(r.ctx, a, 0, 0);

    expect(r.count('save')).toBe(r.count('restore'));
    expect(r.names().at(0)).toBe('save');
    expect(r.names().at(-1)).toBe('restore');
  });
});
