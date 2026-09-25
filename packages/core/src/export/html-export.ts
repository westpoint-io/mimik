import { i18n } from '@/core/env';
import { fitLogo, loadBranding } from '@/core/export/branding';
import { type ExportOptions, IMAGE_SCALE_FACTORS, loadExportOptions } from '@/core/export/options';
import { POPPINS_FONT_FACES } from '@/core/export/poppins';
import {
  blobToBase64,
  escapeHtml,
  extractDomain,
  formatDate,
  LEAD_FONT_PX,
  LEAD_LINE_RATIO,
  LEAD_MARGIN_PX,
  MAX_DESC_LINES,
  MAX_LEAD_LINES,
  MAX_TITLE_LINES,
  stepContext,
} from '@/core/export/utils';
import { actionSteps, calloutAccent, isBlock, stepNumbers, tint, variantLabel } from '@/core/guides/blocks';
import type { Guide, Screenshot, Step } from '@/core/guides/types';
import { dominantRatio, resolveViewport } from '@/core/screenshot/geometry';
import { renderScreenshot } from '@/core/screenshot/render';

const LOGO_MAX_WIDTH = 148;
const LOGO_MAX_HEIGHT = 56;

interface EmbeddedImage {
  type: string;
  b64: string;
}

const imageCache = new WeakMap<Screenshot, { edits: unknown; image: Promise<EmbeddedImage> }>();

function embedScreenshot(screenshot: Screenshot): Promise<EmbeddedImage> {
  const cached = imageCache.get(screenshot);
  if (cached && cached.edits === screenshot.edits) return cached.image;

  const image = renderScreenshot(screenshot).then(async (rendered) => ({
    type: rendered.type,
    b64: await blobToBase64(rendered),
  }));
  image.catch(() => imageCache.delete(screenshot));
  imageCache.set(screenshot, { edits: screenshot.edits, image });
  return image;
}

function blockSection(step: Step): string {
  if (step.blockType === 'heading') {
    return `
      <section data-block="heading" style="margin-bottom:26px;">
        <h2 style="font-size:24px;font-weight:700;line-height:1.3;color:#1E1B4B;white-space:pre-wrap;padding-bottom:10px;border-bottom:2px solid #1E1B4B;">${escapeHtml(step.description)}</h2>
      </section>`;
  }

  const accent = calloutAccent(step);
  const label = variantLabel(step.calloutVariant ?? 'info');
  return `
      <section data-block="callout" role="note" aria-label="${escapeHtml(label)}" style="margin-bottom:52px;padding:14px 18px;border-left:3px solid ${accent};border-radius:8px;background:${tint(accent)};">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#1E1B4B;white-space:pre-wrap;">${escapeHtml(step.description)}</p>
      </section>`;
}

export async function exportGuideAsHTML(
  guide: Guide,
  steps: Step[],
  screenshots: Map<string, Screenshot>,
  options?: ExportOptions,
): Promise<string> {
  const opts = options ?? (await loadExportOptions());
  const brand = await loadBranding();
  const accent = brand.accent;
  const imgWidthPct = Math.round(IMAGE_SCALE_FACTORS[opts.imageScale] * 100);
  const frameRatio = dominantRatio(screenshots);
  const domain = extractDomain(steps);
  const numbers = stepNumbers(steps);
  const stepSections: string[] = [];

  for (const step of steps) {
    if (isBlock(step)) {
      stepSections.push(blockSection(step));
      continue;
    }

    const number = numbers.get(step.id) ?? 0;
    const screenshot = opts.screenshots ? screenshots.get(step.id) : undefined;
    let imgHtml = '';
    if (screenshot) {
      const { type, b64 } = await embedScreenshot(screenshot);
      const altText = screenshot.edits?.alt || i18n.t('export.stepLabel', [String(number)]);
      const viewport = resolveViewport(screenshot);
      const ratio = frameRatio ?? viewport.width / viewport.height;
      imgHtml = `<div style="width:${imgWidthPct}%;aspect-ratio:${ratio};margin-top:6px;border:1px solid #CBD5E1;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;"><img src="data:${type};base64,${b64}" alt="${escapeHtml(altText)}" style="display:block;max-width:100%;max-height:100%;" /></div>`;
    }

    const stepNumber = String(number).padStart(2, '0');
    const ctx = opts.stepUrls ? stepContext(step) : null;
    const urlHtml = !ctx
      ? ''
      : ctx.href
        ? `<a href="${escapeHtml(ctx.href)}" target="_blank" rel="noopener" style="font-size:14px;font-weight:400;color:${accent};">${escapeHtml(ctx.label)}</a>`
        : `<span style="font-size:14px;font-weight:400;color:${accent};">${escapeHtml(ctx.label)}</span>`;

    stepSections.push(`
      <section data-step="${number}" style="display:flex;gap:8mm;margin-bottom:13mm;">
        <div style="flex:0 0 22mm;font-size:34px;font-weight:700;color:${accent};line-height:.9;">${stepNumber}</div>
        <div style="flex:1;min-width:0;border-top:1px solid #1E1B4B;padding-top:6px;">
          <p style="margin:0;font-size:17px;font-weight:700;line-height:1.45;color:#1E1B4B;overflow-wrap:anywhere;">${escapeHtml(step.description)}${
            urlHtml ? `<span style="color:#6B7280;font-weight:400;"> &nbsp;·&nbsp; </span>${urlHtml}` : ''
          }</p>
          ${imgHtml}
        </div>
      </section>`);
  }

  let logoHtml = '';
  if (brand.logo) {
    const { width, height } = fitLogo(brand.logo, LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT);
    logoHtml = `<img src="${brand.logo.dataUrl}" width="${width}" height="${height}" alt="" style="flex-shrink:0;" />`;
  }

  const footerParts: string[] = [];
  footerParts.push(brand.footer ? escapeHtml(brand.footer) : '');
  footerParts.push(brand.attribution ? i18n.t('export.madeWith') : '');
  const footerHtml = footerParts.some(Boolean)
    ? `<footer data-doc-footer="true" style="margin-top:16px;padding-top:20px;border-top:1px solid #E5E7EB;display:flex;justify-content:space-between;gap:16px;font-size:13px;color:#6B7280;">
    <span>${footerParts[0]}</span><span>${footerParts[1]}</span>
  </footer>`
    : '';

  const clamp = (n: number) =>
    `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${n};line-clamp:${n};overflow:hidden;`;

  const metaValue = 'height:38px;display:flex;align-items:center;margin-top:2px;';
  const metaCell = (label: string, value: string) => `
        <div style="flex:0 0 190px;">
          <div style="font-size:11px;font-weight:700;color:#6B7280;letter-spacing:0.06em;">${label}</div>
          <div style="font-size:17px;color:#1E1B4B;${metaValue}">${value}</div>
        </div>`;

  const leadHtml =
    !opts.cover && guide.description
      ? `<p data-lead="true" style="font-size:${LEAD_FONT_PX}px;color:#6B7280;line-height:${LEAD_LINE_RATIO};margin-bottom:${LEAD_MARGIN_PX}px;max-width:60ch;overflow-wrap:anywhere;${clamp(MAX_LEAD_LINES)}">${escapeHtml(guide.description)}</p>`
      : '';

  const headerHtml = opts.cover
    ? `<header data-cover="true" style="margin-bottom:56px;">
    <div style="margin-bottom:26px;">
      <div style="display:flex;align-items:flex-end;gap:24px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:11px;font-weight:700;color:#6B7280;letter-spacing:0.08em;">${i18n.t('export.guideLabel')}</div>
          <h1 style="font-size:38px;font-weight:700;line-height:1.15;margin-top:18px;overflow-wrap:anywhere;${clamp(MAX_TITLE_LINES)}">${escapeHtml(guide.title)}</h1>
        </div>
        ${logoHtml}
      </div>
      ${guide.description ? `<p style="font-size:16px;color:#6B7280;line-height:1.6;margin-top:14px;max-width:60ch;overflow-wrap:anywhere;${clamp(MAX_DESC_LINES)}">${escapeHtml(guide.description)}</p>` : ''}
    </div>
    <div style="border-top:2px solid #1E1B4B;padding-top:18px;display:flex;align-items:baseline;">
      <div style="flex:0 0 190px;">
        <div style="font-size:11px;font-weight:700;color:#6B7280;letter-spacing:0.06em;">${i18n.t('export.steps').toUpperCase()}</div>
        <div style="font-size:38px;font-weight:700;color:${accent};line-height:1;${metaValue}">${String(actionSteps(steps).length).padStart(2, '0')}</div>
      </div>
      ${metaCell(i18n.t('export.created').toUpperCase(), formatDate(guide.createdAt))}
      ${
        domain
          ? metaCell(
              i18n.t('export.source').toUpperCase(),
              `<a href="https://${escapeHtml(domain)}" target="_blank" rel="noopener" style="color:${accent};">${escapeHtml(domain)}</a>`,
            )
          : ''
      }
    </div>
  </header>`
    : `<header data-doc-header="true" style="display:flex;align-items:center;gap:16px;margin-bottom:40px;padding-bottom:14px;border-bottom:1px solid #E5E7EB;">
    <h1 style="flex:1;min-width:0;font-size:20px;font-weight:700;line-height:1.2;overflow-wrap:anywhere;${clamp(1)}">${escapeHtml(guide.title)}</h1>
    ${logoHtml}
  </header>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(guide.title)}</title>
  ${guide.description ? `<meta name="description" content="${escapeHtml(guide.description)}">` : ''}
  <style>
    ${POPPINS_FONT_FACES}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Poppins', sans-serif; max-width: 860px; margin: 0 auto; padding: 56px 28px; color: #1E1B4B; background: #fff; }
    a { text-decoration: none; }
  </style>
</head>
<body>
  ${headerHtml}
  ${leadHtml}

  ${stepSections.join('\n')}
  ${footerHtml}
</body>
</html>`;
}
