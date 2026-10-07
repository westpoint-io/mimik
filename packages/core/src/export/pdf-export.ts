import { jsPDF } from 'jspdf';
import { i18n } from '@/core/env';
import { fitLogo, loadBranding } from '@/core/export/branding';
import { type ExportOptions, IMAGE_SCALE_FACTORS, loadExportOptions } from '@/core/export/options';
import { CONTENT_BOTTOM_MM, HEAD_BAND_MM, PAGE_MARGIN_MM, STEP_TOP_MM } from '@/core/export/page';
import { measurer, needsRaster, rasterize, wrap } from '@/core/export/pdf-text';
import {
  blobToDataUrl,
  clampLines,
  containFit,
  extractDomain,
  fitImage,
  formatDate,
  LEAD_FONT_PX,
  LEAD_LINE_RATIO,
  LEAD_MARGIN_PX,
  MAX_DESC_LINES,
  MAX_LEAD_LINES,
  MAX_TITLE_LINES,
  pxToMm,
  stepContext,
} from '@/core/export/utils';
import { actionSteps, calloutAccent, isBlock, stepNumbers, tint } from '@/core/guides/blocks';
import type { Guide, Screenshot, Step } from '@/core/guides/types';
import { logger } from '@/core/logger';
import { hexToRgb } from '@/core/screenshot/color';
import { dominantRatio, resolveViewport } from '@/core/screenshot/geometry';
import { renderScreenshot } from '@/core/screenshot/render';

const JPEG_QUALITY = 0.85;

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = PAGE_MARGIN_MM;
const CONTENT_W = PAGE_W - MARGIN * 2;
const NUM_COL = 22;
const COL_GAP = 8;
const TEXT_COL = CONTENT_W - NUM_COL - COL_GAP;
const TEXT_X = MARGIN + NUM_COL + COL_GAP;
const RIGHT = PAGE_W - MARGIN;
const FOOTER_Y = PAGE_H - 24;
const HEAD_BOTTOM = MARGIN + HEAD_BAND_MM;
const STEP_TOP = STEP_TOP_MM;
const STEP_GAP = 13;
const LOGO_MAX_W = 34;
const LOGO_MAX_H = 15;
const HEAD_LOGO_W = 18;
const HEAD_LOGO_H = 5;
const COVER_RULE_GAP = 8;
const TITLE_LINE_H = 11;
const TEXT_LINE_H = 5;
const LEAD_SIZE = (LEAD_FONT_PX * 72) / 96;
const LEAD_LINE_H = pxToMm(LEAD_FONT_PX * LEAD_LINE_RATIO);
const LEAD_BASELINE = 4;
const LEAD_GAP = pxToMm(LEAD_MARGIN_PX) + LEAD_LINE_H - LEAD_BASELINE;
const META_COL_W = 43;
const META_DROP = 9;
const META_NUM_SIZE = 30;
const META_VALUE_SIZE = 11;
const META_CAP_RATIO = 0.7;
const META_VALUE_LIFT = (((META_NUM_SIZE - META_VALUE_SIZE) * META_CAP_RATIO) / 72) * 25.4 * 0.5;
const BLOCK_GAP = 9;
const HEADING_SIZE = 14;
const HEADING_LINE_H = 6.5;
const HEADING_BASELINE = 5;
const HEADING_RULE_GAP = 3.2;
const CALLOUT_SIZE = 11;
const CALLOUT_LINE_H = 5;
const CALLOUT_BASELINE = 4;
const CALLOUT_PAD_X = 5;
const CALLOUT_PAD_Y = 4;
const CALLOUT_BAR_W = 2;
const CALLOUT_RADIUS = 2;

const INK: [number, number, number] = [30, 27, 75];
const MUTED: [number, number, number] = [107, 114, 128];
const HAIR: [number, number, number] = [229, 231, 235];
const PAPER: [number, number, number] = [255, 255, 255];

type Rgb = readonly [number, number, number];

function splitFor(doc: jsPDF, text: string, maxWidth: number, size: number, bold: boolean): string[] {
  if (!needsRaster(text)) return doc.splitTextToSize(text, maxWidth);
  const measure = measurer(size, bold);
  return measure ? wrap(text, maxWidth, measure) : doc.splitTextToSize(text, maxWidth);
}

function widthOf(doc: jsPDF, text: string, size: number, bold: boolean): number {
  if (!needsRaster(text)) return doc.getTextWidth(text);
  return measurer(size, bold)?.(text) ?? doc.getTextWidth(text);
}

function writeLines(
  doc: jsPDF,
  lines: string[],
  x: number,
  baseline: number,
  size: number,
  bold: boolean,
  color: Rgb,
  lineHeight: number,
): void {
  doc.setFontSize(size);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setTextColor(color[0], color[1], color[2]);
  const raster = lines.some(needsRaster)
    ? rasterize(lines, size, bold, lineHeight, `rgb(${color[0]},${color[1]},${color[2]})`)
    : null;
  if (raster) {
    try {
      doc.addImage(raster.dataUrl, 'PNG', x, baseline - raster.ascent, raster.width, raster.height);
      return;
    } catch (err) {
      logger.warn('PDF: failed to draw rasterised text, falling back to the base font', err);
    }
  }
  doc.text(lines, x, baseline);
}

export async function exportGuideAsPDF(
  guide: Guide,
  steps: Step[],
  screenshots: Map<string, Screenshot>,
  options?: ExportOptions,
): Promise<Blob> {
  const opts = options ?? (await loadExportOptions());
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const actions = actionSteps(steps);
  const numbers = stepNumbers(steps);
  const domain = extractDomain(steps);
  const brand = await loadBranding();
  const accent = hexToRgb(brand.accent) ?? [79, 70, 229];
  const logo = brand.logo ? fitLogo(brand.logo, LOGO_MAX_W, LOGO_MAX_H) : null;
  const headLogo = !opts.cover && brand.logo ? fitLogo(brand.logo, HEAD_LOGO_W, HEAD_LOGO_H) : null;
  const headRight = headLogo ? RIGHT - headLogo.width - 4 : RIGHT;
  const imgWidth = TEXT_COL * IMAGE_SCALE_FACTORS[opts.imageScale];
  const frameRatio = dominantRatio(screenshots);
  if (opts.cover) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MUTED);
    doc.text(i18n.t('export.guideLabel'), MARGIN, MARGIN + 4, { charSpace: 0.6 });

    doc.setFontSize(30);
    doc.setTextColor(...INK);
    const titleLines = clampLines(splitFor(doc, guide.title, CONTENT_W * 0.82, 30, true), MAX_TITLE_LINES);
    writeLines(doc, titleLines, MARGIN, MARGIN + 26, 30, true, INK, TITLE_LINE_H);

    const titleBottom = MARGIN + 26 + (titleLines.length - 1) * TITLE_LINE_H;
    if (brand.logo && logo) {
      try {
        doc.addImage(brand.logo.dataUrl, 'PNG', RIGHT - logo.width, titleBottom - logo.height, logo.width, logo.height);
      } catch (err) {
        logger.warn('PDF: failed to draw brand logo', err);
      }
    }

    let y = titleBottom + COVER_RULE_GAP;
    if (guide.description) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      const descLines = clampLines(splitFor(doc, guide.description, CONTENT_W * 0.7, 11, false), MAX_DESC_LINES);
      writeLines(doc, descLines, MARGIN, y + 4, 11, false, MUTED, 5);
      y += 4 + (descLines.length - 1) * 5 + COVER_RULE_GAP;
    }

    doc.setDrawColor(...INK);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, y, RIGHT, y);

    const yLabel = y + 12;
    const yValue = yLabel + META_DROP;
    const drawLabel = (text: string, x: number) => {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...MUTED);
      doc.text(text, x, yLabel, { charSpace: 0.4 });
    };

    const yText = yValue - META_VALUE_LIFT;

    drawLabel(i18n.t('export.steps').toUpperCase(), MARGIN);
    doc.setFontSize(META_NUM_SIZE);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...accent);
    doc.text(String(actions.length).padStart(2, '0'), MARGIN, yValue);

    drawLabel(i18n.t('export.created').toUpperCase(), MARGIN + META_COL_W);
    doc.setFontSize(META_VALUE_SIZE);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK);
    doc.text(formatDate(guide.createdAt), MARGIN + META_COL_W, yText);

    if (domain) {
      const x = MARGIN + META_COL_W * 2;
      drawLabel(i18n.t('export.source').toUpperCase(), x);
      doc.setFontSize(META_VALUE_SIZE);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...accent);
      doc.textWithLink(domain, x, yText, { url: `https://${domain}` });
    }
  }
  const pageSteps: number[][] = [];
  const coverPages = opts.cover ? 1 : 0;

  const startStepPage = () => {
    if (coverPages > 0 || pageSteps.length > 0) doc.addPage();
    pageSteps.push([]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    writeLines(doc, [splitFor(doc, guide.title, CONTENT_W * 0.7, 8, true)[0]!], MARGIN, MARGIN + 3, 8, true, INK, 3);
    if (brand.logo && headLogo) {
      try {
        doc.addImage(
          brand.logo.dataUrl,
          'PNG',
          RIGHT - headLogo.width,
          MARGIN + (HEAD_BOTTOM - MARGIN - headLogo.height) / 2,
          headLogo.width,
          headLogo.height,
        );
      } catch (err) {
        logger.warn('PDF: failed to draw brand logo in running head', err);
      }
    }
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, HEAD_BOTTOM, RIGHT, HEAD_BOTTOM);
    return STEP_TOP;
  };

  let sy = startStepPage();

  if (!opts.cover && guide.description) {
    doc.setFontSize(LEAD_SIZE);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    const leadLines = clampLines(splitFor(doc, guide.description, CONTENT_W * 0.8, LEAD_SIZE, false), MAX_LEAD_LINES);
    writeLines(doc, leadLines, MARGIN, sy + LEAD_BASELINE, LEAD_SIZE, false, MUTED, LEAD_LINE_H);
    sy += LEAD_BASELINE + (leadLines.length - 1) * LEAD_LINE_H + LEAD_GAP;
  }

  for (const step of steps) {
    if (isBlock(step)) {
      sy = drawBlock(doc, step, sy, startStepPage);
      continue;
    }
    const stepNum = String(numbers.get(step.id) ?? 0).padStart(2, '0');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const descLines = splitFor(doc, step.description, TEXT_COL, 11, true);

    const screenshot = opts.screenshots ? screenshots.get(step.id) : undefined;
    let imgDataUrl: string | null = null;
    let frame = { width: imgWidth, height: 0 };
    let img = { width: 0, height: 0, x: 0, y: 0 };
    const textOverhead = 6 + descLines.length * TEXT_LINE_H + 4;
    if (screenshot) {
      try {
        const rendered = await renderScreenshot(screenshot, { format: 'image/jpeg', quality: JPEG_QUALITY });
        imgDataUrl = await blobToDataUrl(rendered);
        const viewport = resolveViewport(screenshot);
        const ratio = frameRatio ?? viewport.width / viewport.height;
        frame = fitImage(imgWidth, imgWidth / ratio, CONTENT_BOTTOM_MM - STEP_TOP - textOverhead);
        img = containFit(viewport.width, viewport.height, frame.width, frame.height);
      } catch (err) {
        logger.warn('PDF: failed to load screenshot for step', step.index, err);
      }
    }

    const blockH = textOverhead - TEXT_LINE_H + frame.height;
    if (sy + blockH > CONTENT_BOTTOM_MM && sy > STEP_TOP) {
      sy = startStepPage();
    }
    pageSteps[pageSteps.length - 1]!.push(numbers.get(step.id) ?? 0);

    doc.setFontSize(30);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...accent);
    doc.text(stepNum, MARGIN, sy + 8);

    doc.setDrawColor(...INK);
    doc.setLineWidth(0.3);
    doc.line(TEXT_X, sy, RIGHT, sy);

    writeLines(doc, descLines, TEXT_X, sy + 6, 11, true, INK, TEXT_LINE_H);

    let ux = TEXT_X + widthOf(doc, descLines[descLines.length - 1]!, 11, true);
    let uy = sy + 6 + (descLines.length - 1) * 5;

    const stepCtx = opts.stepUrls ? stepContext(step, 64) : null;
    if (stepCtx) {
      const label = stepCtx.label;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const sep = '   ·   ';
      const sepW = doc.getTextWidth(sep);
      const urlW = doc.getTextWidth(label);
      if (ux + sepW + urlW > RIGHT) {
        ux = TEXT_X;
        uy += 5;
      } else {
        doc.setTextColor(...MUTED);
        doc.text(sep, ux, uy);
        ux += sepW;
      }
      doc.setTextColor(...accent);
      if (stepCtx.href) {
        doc.textWithLink(label, ux, uy, { url: stepCtx.href });
        doc.setDrawColor(...accent);
        doc.setLineWidth(0.2);
        doc.line(ux, uy + 0.9, ux + urlW, uy + 0.9);
      } else {
        doc.text(label, ux, uy);
      }
    }

    let iy = uy + 4;
    if (imgDataUrl) {
      doc.addImage(imgDataUrl, 'JPEG', TEXT_X + img.x, iy + img.y, img.width, img.height);
      const altText = screenshot?.edits?.alt || i18n.t('export.stepLabel', [stepNum]);
      doc.text(doc.splitTextToSize(altText, frame.width), TEXT_X, iy + 4, { renderingMode: 'invisible' });
      iy += frame.height;
    }
    sy = iy + STEP_GAP;
  }
  const totalPages = doc.getNumberOfPages();
  const attribution = brand.attribution ? i18n.t('export.madeWith') : '';
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);

    const onPage = pageSteps[p - 1 - coverPages];
    if (onPage?.length) {
      const range =
        onPage.length > 1
          ? i18n.t('export.stepsRange', [String(onPage[0]), String(onPage[onPage.length - 1]), String(actions.length)])
          : i18n.t('export.stepOf', [String(onPage[0]), String(actions.length)]);
      doc.text(range, headRight, MARGIN + 3, { align: 'right' });
    }

    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, FOOTER_Y, RIGHT, FOOTER_Y);
    const fy = FOOTER_Y + 4;
    if (brand.footer) writeLines(doc, [brand.footer], MARGIN, fy, 8, false, MUTED, 3);
    if (attribution) doc.text(attribution, PAGE_W / 2, fy, { align: 'center' });
    doc.text(`${p} / ${totalPages}`, RIGHT, fy, { align: 'right' });
  }

  return doc.output('blob');
}

function drawBlock(doc: jsPDF, step: Step, y: number, nextPage: () => number): number {
  if (step.blockType === 'heading') {
    doc.setFontSize(HEADING_SIZE);
    doc.setFont('helvetica', 'bold');
    const lines = splitFor(doc, step.description, CONTENT_W, HEADING_SIZE, true);
    const blockH = HEADING_BASELINE + (lines.length - 1) * HEADING_LINE_H + HEADING_RULE_GAP;
    let sy = y;
    if (sy + blockH > CONTENT_BOTTOM_MM && sy > STEP_TOP) sy = nextPage();
    writeLines(doc, lines, MARGIN, sy + HEADING_BASELINE, HEADING_SIZE, true, INK, HEADING_LINE_H);
    const ruleY = sy + blockH;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, ruleY, RIGHT, ruleY);
    return ruleY + BLOCK_GAP;
  }

  const accent = calloutAccent(step);
  const bar = hexToRgb(accent) ?? INK;
  const fill = hexToRgb(tint(accent)) ?? PAPER;
  const textX = MARGIN + CALLOUT_BAR_W + CALLOUT_PAD_X;
  doc.setFontSize(CALLOUT_SIZE);
  doc.setFont('helvetica', 'normal');
  const lines = splitFor(doc, step.description, RIGHT - CALLOUT_PAD_X - textX, CALLOUT_SIZE, false);
  const boxH = CALLOUT_PAD_Y * 2 + lines.length * CALLOUT_LINE_H;
  let sy = y;
  if (sy + boxH > CONTENT_BOTTOM_MM && sy > STEP_TOP) sy = nextPage();
  doc.setFillColor(...fill);
  doc.roundedRect(MARGIN, sy, CONTENT_W, boxH, CALLOUT_RADIUS, CALLOUT_RADIUS, 'F');
  doc.setFillColor(...bar);
  doc.rect(MARGIN, sy + CALLOUT_RADIUS, CALLOUT_BAR_W, boxH - CALLOUT_RADIUS * 2, 'F');
  writeLines(doc, lines, textX, sy + CALLOUT_PAD_Y + CALLOUT_BASELINE, CALLOUT_SIZE, false, INK, CALLOUT_LINE_H);
  return sy + boxH + BLOCK_GAP;
}
