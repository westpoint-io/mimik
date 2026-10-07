const MM_PER_PT = 25.4 / 72;
const RASTER_SCALE = 4;
// Only a fallback, for engines that withhold the fontBoundingBox metrics.
const ASCENT_RATIO = 0.8;
const DESCENT_RATIO = 0.2;
const RASTER_FONTS =
  '"Noto Sans", "Noto Sans CJK SC", "Noto Sans CJK JP", "Microsoft YaHei", "PingFang SC", "Hiragino Sans", "Malgun Gothic", system-ui, -apple-system, "Segoe UI", Arial, sans-serif';

const WINANSI_EXTRAS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018,
  0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

export function needsRaster(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0xff) continue;
    if (WINANSI_EXTRAS.has(code)) continue;
    return true;
  }
  return false;
}

const CJK = /[ᄀ-ᇿ⺀-鿿ꥠ-꥿가-퟿豈-﫿︰-﹏＀-｠￠-￦]|[\u{20000}-\u{3ffff}]/u;

export function segments(text: string): string[] {
  const out: string[] = [];
  let word = '';
  for (const char of text) {
    if (/\s/.test(char) || CJK.test(char)) {
      if (word) {
        out.push(word);
        word = '';
      }
      out.push(char);
      continue;
    }
    word += char;
  }
  if (word) out.push(word);
  return out;
}

export function wrap(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const seg of segments(text)) {
    if (seg === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    const next = line + seg;
    if (line && measure(next) > maxWidth) {
      lines.push(line.replace(/\s+$/, ''));
      line = /\s/.test(seg) ? '' : seg;
      continue;
    }
    line = next;
  }
  if (line.trim()) lines.push(line.replace(/\s+$/, ''));
  return lines.length ? lines : [''];
}

function context(): CanvasRenderingContext2D | null {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

export interface RasterText {
  dataUrl: string;
  width: number;
  height: number;
  ascent: number;
}

function fontSpec(sizePt: number, bold: boolean): string {
  return `${bold ? 'bold ' : ''}${sizePt}px ${RASTER_FONTS}`;
}

export function measurer(sizePt: number, bold: boolean): ((s: string) => number) | null {
  const ctx = context();
  if (!ctx) return null;
  ctx.font = fontSpec(sizePt, bold);
  return (s: string) => ctx.measureText(s).width * MM_PER_PT;
}

export interface FontBox {
  ascent: number;
  descent: number;
}

interface BoxMetrics {
  fontBoundingBoxAscent?: number;
  fontBoundingBoxDescent?: number;
}

/**
 * The tallest font box across the measured lines, in css px.
 *
 * A font stack renders CJK through a fallback face whose box is far taller than
 * a latin one, so the box has to be measured from the text actually being drawn.
 * Assuming a fixed ratio clipped the top rows off every CJK line.
 */
export function boxFrom(metrics: BoxMetrics[], sizePt: number): FontBox {
  let ascent = 0;
  let descent = 0;
  for (const m of metrics) {
    if (typeof m.fontBoundingBoxAscent === 'number' && Number.isFinite(m.fontBoundingBoxAscent)) {
      ascent = Math.max(ascent, m.fontBoundingBoxAscent);
    }
    if (typeof m.fontBoundingBoxDescent === 'number' && Number.isFinite(m.fontBoundingBoxDescent)) {
      descent = Math.max(descent, m.fontBoundingBoxDescent);
    }
  }
  if (ascent > 0) return { ascent, descent };
  return { ascent: sizePt * ASCENT_RATIO, descent: sizePt * DESCENT_RATIO };
}

export interface RasterLayout {
  deviceWidth: number;
  deviceHeight: number;
  width: number;
  height: number;
  ascent: number;
  baselines: number[];
}

/**
 * Canvas geometry for a run of lines: the device pixels to allocate, the
 * millimetres those pixels stand for, and where each baseline sits.
 *
 * Kept pure so the geometry is testable without a canvas implementation, which
 * jsdom does not provide.
 */
export function layout(widest: number, lineCount: number, lineHeight: number, box: FontBox): RasterLayout {
  const count = Math.max(lineCount, 1);
  const step = lineHeight / MM_PER_PT;
  const ink = box.ascent + (count - 1) * step + box.descent;
  const deviceWidth = Math.max(1, Math.ceil((widest / MM_PER_PT) * RASTER_SCALE));
  const deviceHeight = Math.max(1, Math.ceil(Math.max(count * step, ink) * RASTER_SCALE));
  return {
    deviceWidth,
    deviceHeight,
    width: (deviceWidth / RASTER_SCALE) * MM_PER_PT,
    height: (deviceHeight / RASTER_SCALE) * MM_PER_PT,
    ascent: box.ascent * MM_PER_PT,
    baselines: Array.from({ length: count }, (_, i) => box.ascent + i * step),
  };
}

export function rasterize(
  lines: string[],
  sizePt: number,
  bold: boolean,
  lineHeight: number,
  color: string,
): RasterText | null {
  const probe = context();
  if (!probe) return null;
  const font = fontSpec(sizePt, bold);
  probe.font = font;
  const widest = Math.max(...lines.map((line) => probe.measureText(line).width * MM_PER_PT), 0.01);
  const inked = lines.filter((line) => line.length > 0);
  const box = boxFrom(
    (inked.length ? inked : ['M']).map((line) => probe.measureText(line)),
    sizePt,
  );
  const frame = layout(widest, lines.length, lineHeight, box);

  const canvas = document.createElement('canvas');
  canvas.width = frame.deviceWidth;
  canvas.height = frame.deviceHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(RASTER_SCALE, RASTER_SCALE);
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  for (const [i, line] of lines.entries()) ctx.fillText(line, 0, frame.baselines[i]!);
  return { dataUrl: canvas.toDataURL('image/png'), width: frame.width, height: frame.height, ascent: frame.ascent };
}
