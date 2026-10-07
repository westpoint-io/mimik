import { describe, expect, it } from 'vitest';
import { boxFrom, layout, needsRaster, segments, wrap } from '@/core/export/pdf-text';

describe('needsRaster', () => {
  it('leaves latin text on the vector path', () => {
    expect(needsRaster('Click the Submit button')).toBe(false);
  });

  it('leaves accented latin on the vector path', () => {
    expect(needsRaster('Créer un café — naïve')).toBe(false);
  });

  it('leaves winansi punctuation on the vector path', () => {
    expect(needsRaster('“quoted” • dash – ellipsis… €99 ™')).toBe(false);
  });

  it('rasterises chinese', () => {
    expect(needsRaster('点击开始录制')).toBe(true);
  });

  it('rasterises cyrillic, greek, japanese, korean, arabic and thai', () => {
    for (const text of ['Привет', 'Καλημέρα', 'こんにちは', '안녕하세요', 'مرحبا', 'สวัสดี']) {
      expect(needsRaster(text)).toBe(true);
    }
  });

  it('rasterises latin mixed with a single non-latin character', () => {
    expect(needsRaster('Open 设置 page')).toBe(true);
  });
});

describe('segments', () => {
  it('keeps latin words whole and splits cjk per character', () => {
    expect(segments('open 设置 now')).toEqual(['open', ' ', '设', '置', ' ', 'now']);
  });
});

describe('wrap', () => {
  const measure = (s: string) => s.length;

  it('breaks latin on spaces', () => {
    expect(wrap('aaa bbb ccc', 7, measure)).toEqual(['aaa bbb', 'ccc']);
  });

  it('breaks cjk between characters, since it has no spaces', () => {
    expect(wrap('点击开始录制', 3, measure)).toEqual(['点击开', '始录制']);
  });

  it('never returns an empty list', () => {
    expect(wrap('', 10, measure)).toEqual(['']);
  });

  it('keeps a word that cannot fit rather than looping forever', () => {
    expect(wrap('supercalifragilistic', 5, measure)).toEqual(['supercalifragilistic']);
  });
});

const MM_PER_PT = 25.4 / 72;

// Noto Sans CJK reports a box far taller than the 0.8em the raster path used to
// assume; Latin faces sit comfortably inside it. These are the two cases that
// decide whether a glyph keeps its top row.
const CJK_BOX = { ascent: 13.92, descent: 3.456 }; // 1.16em / 0.288em at 12pt
const LATIN_BOX = { ascent: 9, descent: 3 }; //        0.75em / 0.25em at 12pt

const metrics = (ascent?: number, descent?: number) => ({
  fontBoundingBoxAscent: ascent,
  fontBoundingBoxDescent: descent,
});

describe('boxFrom', () => {
  it('reads the font box the engine reports', () => {
    expect(boxFrom([metrics(13.92, 3.456)], 12)).toEqual(CJK_BOX);
  });

  it('takes the tallest box when a run mixes scripts', () => {
    const box = boxFrom([metrics(9, 3), metrics(13.92, 3.456)], 12);
    expect(box).toEqual(CJK_BOX);
  });

  it('falls back to the old ratio when the engine withholds the box', () => {
    const box = boxFrom([metrics(undefined, undefined)], 12);
    expect(box.ascent).toBeCloseTo(9.6);
    expect(box.descent).toBeCloseTo(2.4);
  });

  it('falls back when the engine reports a zero ascent', () => {
    const box = boxFrom([metrics(0, 0)], 10);
    expect(box.ascent).toBeCloseTo(8);
    expect(box.descent).toBeCloseTo(2);
  });
});

describe('layout', () => {
  const lineHeightMm = 5;
  const step = lineHeightMm / MM_PER_PT;

  it('puts the first baseline at the font ascent, so the glyph top is not clipped', () => {
    // The defect: the baseline used to sit at 0.8em (9.6px), which is above the
    // 13.92px CJK ascent, so every CJK line lost its top rows off the canvas.
    const l = layout(40, 1, lineHeightMm, CJK_BOX);
    expect(l.baselines[0]).toBeCloseTo(CJK_BOX.ascent);
    expect(l.baselines[0]).toBeGreaterThan(12 * 0.8);
  });

  it('grows the canvas when ascent plus descent exceeds the line height', () => {
    const l = layout(40, 1, lineHeightMm, CJK_BOX);
    const needed = CJK_BOX.ascent + CJK_BOX.descent;
    expect(needed).toBeGreaterThan(step); // the case under test is real
    expect(l.height / MM_PER_PT).toBeGreaterThanOrEqual(needed);
  });

  it('leaves the height at the line box when the font fits inside it', () => {
    const l = layout(40, 2, lineHeightMm, LATIN_BOX);
    // ink needs 26.2px and the two line boxes need 28.3px, so the line box governs
    expect(LATIN_BOX.ascent + step + LATIN_BOX.descent).toBeLessThan(2 * step);
    expect(l.height / MM_PER_PT).toBeCloseTo(2 * step, 0);
  });

  it('steps each baseline by exactly one line height', () => {
    const l = layout(40, 3, lineHeightMm, LATIN_BOX);
    expect(l.baselines).toHaveLength(3);
    expect(l.baselines[1]! - l.baselines[0]!).toBeCloseTo(step);
    expect(l.baselines[2]! - l.baselines[1]!).toBeCloseTo(step);
  });

  it('keeps the last descender inside the canvas', () => {
    const l = layout(40, 4, lineHeightMm, CJK_BOX);
    const lastInk = l.baselines[3]! + CJK_BOX.descent;
    expect(l.height / MM_PER_PT).toBeGreaterThanOrEqual(lastInk);
  });

  it('reports millimetres that match the device pixels, so addImage cannot stretch', () => {
    const l = layout(40, 2, lineHeightMm, CJK_BOX);
    expect(l.width).toBeCloseTo((l.deviceWidth / 4) * MM_PER_PT);
    expect(l.height).toBeCloseTo((l.deviceHeight / 4) * MM_PER_PT);
  });

  it('reports the ascent in millimetres, since pdf-export offsets the image by it', () => {
    const l = layout(40, 1, lineHeightMm, CJK_BOX);
    expect(l.ascent).toBeCloseTo(CJK_BOX.ascent * MM_PER_PT);
  });

  it('never asks for a zero-sized canvas', () => {
    const l = layout(0.01, 1, lineHeightMm, LATIN_BOX);
    expect(l.deviceWidth).toBeGreaterThanOrEqual(1);
    expect(l.deviceHeight).toBeGreaterThanOrEqual(1);
  });
});
