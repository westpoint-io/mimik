import type { Annotation, ArrowEnd } from './types';
import { DEFAULT_LINE_HEIGHT, FONT_FAMILIES, LINE_WIDTHS } from './types';

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export const TARGET_STROKE = 3.5;
export const TARGET_RADIUS = 12;

export function drawRoundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawArrowEnd(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, width: number, end: ArrowEnd) {
  if (end === 'none') return;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = width * 4;
  ctx.save();
  ctx.translate(x2, y2);
  ctx.rotate(angle);
  ctx.beginPath();
  switch (end) {
    case 'bar':
      ctx.moveTo(0, -size / 2);
      ctx.lineTo(0, size / 2);
      ctx.stroke();
      break;
    case 'arrow':
      ctx.moveTo(-size, -size / 2);
      ctx.lineTo(0, 0);
      ctx.lineTo(-size, size / 2);
      ctx.stroke();
      break;
    case 'arrow-solid':
      ctx.moveTo(0, 0);
      ctx.lineTo(-size, -size / 2);
      ctx.lineTo(-size, size / 2);
      ctx.closePath();
      ctx.fill();
      break;
    case 'circle':
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'circle-solid':
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'square':
      ctx.rect(-size / 2, -size / 2, size, size);
      ctx.stroke();
      break;
    case 'square-solid':
      ctx.rect(-size / 2, -size / 2, size, size);
      ctx.fill();
      break;
  }
  ctx.restore();
}

export const BLUR_RADIUS = 12;
export const BLUR_MARGIN = BLUR_RADIUS * 2;
export const BLUR_CELL = 8;

type Rect = { x: number; y: number; w: number; h: number };

function drawBlurRedaction(ctx: Ctx, a: Rect, originX: number, originY: number) {
  const { width, height } = ctx.canvas;
  const boxX = a.x - originX;
  const boxY = a.y - originY;
  const left = Math.max(0, boxX - BLUR_MARGIN);
  const top = Math.max(0, boxY - BLUR_MARGIN);
  const right = Math.min(width, boxX + a.w + BLUR_MARGIN);
  const bottom = Math.min(height, boxY + a.h + BLUR_MARGIN);
  const inX = Math.max(0, boxX);
  const inY = Math.max(0, boxY);
  const inW = Math.min(width, boxX + a.w) - inX;
  const inH = Math.min(height, boxY + a.h) - inY;
  if (inW <= 0 || inH <= 0) return;

  ctx.beginPath();
  ctx.rect(a.x, a.y, a.w, a.h);
  ctx.clip();

  const cellsX = Math.max(1, Math.ceil(inW / BLUR_CELL));
  const cellsY = Math.max(1, Math.ceil(inH / BLUR_CELL));
  const destX = inX + originX;
  const destY = inY + originY;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(ctx.canvas, inX, inY, inW, inH, destX, destY, cellsX, cellsY);
  ctx.drawImage(ctx.canvas, inX, inY, cellsX, cellsY, destX, destY, inW, inH);

  ctx.filter = `blur(${BLUR_RADIUS}px)`;
  ctx.drawImage(
    ctx.canvas,
    left,
    top,
    right - left,
    bottom - top,
    left + originX,
    top + originY,
    right - left,
    bottom - top,
  );
}

export function drawAnnotation(ctx: Ctx, a: Annotation, originX: number, originY: number) {
  ctx.save();
  switch (a.type) {
    case 'box':
      ctx.lineWidth = LINE_WIDTHS[a.lineWidth ?? 'ms'];
      if (a.fill && a.fill !== 'transparent') {
        ctx.fillStyle = a.fill;
        drawRoundedRect(ctx, a.x, a.y, a.w, a.h, a.radius ?? 0);
        ctx.fill();
      }
      if (ctx.lineWidth > 0) {
        ctx.strokeStyle = a.color;
        drawRoundedRect(ctx, a.x, a.y, a.w, a.h, a.radius ?? 0);
        ctx.stroke();
      }
      break;
    case 'ellipse':
      ctx.lineWidth = LINE_WIDTHS[a.lineWidth ?? 'ms'];
      ctx.beginPath();
      ctx.ellipse(a.x + a.w / 2, a.y + a.h / 2, Math.abs(a.w / 2), Math.abs(a.h / 2), 0, 0, Math.PI * 2);
      if (a.fill && a.fill !== 'transparent') {
        ctx.fillStyle = a.fill;
        ctx.fill();
      }
      ctx.strokeStyle = a.color;
      ctx.stroke();
      break;
    case 'target':
      ctx.strokeStyle = a.color;
      ctx.lineWidth = TARGET_STROKE;
      if (a.border === 'dashed') ctx.setLineDash([8, 5]);
      drawRoundedRect(ctx, a.x, a.y, a.w, a.h, TARGET_RADIUS);
      ctx.stroke();
      break;
    case 'arrow': {
      const w = LINE_WIDTHS[a.lineWidth ?? 'ms'];
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x1, a.y1);
      ctx.lineTo(a.x2, a.y2);
      ctx.stroke();
      drawArrowEnd(ctx, a.x1, a.y1, a.x2, a.y2, w, a.end ?? 'arrow-solid');
      break;
    }
    case 'text': {
      const px = a.size;
      const family = FONT_FAMILIES[a.fontFamily ?? 'sans-serif'];
      const style = a.italic ? 'italic ' : '';
      const weight = a.bold ? 700 : 500;
      ctx.fillStyle = a.color;
      ctx.font = `${style}${weight} ${px}px ${family}`;
      const ratio = typeof a.lineHeight === 'number' ? a.lineHeight : DEFAULT_LINE_HEIGHT;
      const lh = px * ratio;
      a.text.split('\n').forEach((line, i) => {
        ctx.fillText(line, a.x, a.y + i * lh);
      });
      break;
    }
    case 'freehand':
      ctx.strokeStyle = a.color;
      ctx.lineWidth = LINE_WIDTHS[a.lineWidth ?? 'md'];
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.points[0], a.points[1]);
      for (let i = 2; i < a.points.length; i += 2) ctx.lineTo(a.points[i], a.points[i + 1]);
      ctx.stroke();
      break;
    case 'redact':
      if (a.style === 'solid') {
        ctx.fillStyle = '#1E1B4B';
        ctx.fillRect(a.x, a.y, a.w, a.h);
      } else {
        drawBlurRedaction(ctx, a, originX, originY);
      }
      break;
  }
  ctx.restore();
}
