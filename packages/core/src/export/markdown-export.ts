import { i18n } from '@/core/env';
import { blobToBase64, extractDomain, formatDate } from '@/core/export/utils';
import { actionSteps, isBlock, stepNumbers, variantLabel } from '@/core/guides/blocks';
import { sanitizeGuideTitle } from '@/core/guides/title';
import type { Guide, Screenshot, Step } from '@/core/guides/types';
import { renderScreenshot } from '@/core/screenshot/render';

function blockLines(step: Step): string[] {
  if (step.blockType === 'heading') return [`## ${step.description}`];
  const label = variantLabel(step.calloutVariant ?? 'info');
  const body = step.description.split('\n').map((line) => (line ? `> ${line}` : '>'));
  return [`> **${label}**`, '>', ...body];
}

export async function exportGuideAsMarkdown(
  guide: Guide,
  steps: Step[],
  screenshots: Map<string, Screenshot>,
): Promise<string> {
  const domain = extractDomain(steps);
  const numbers = stepNumbers(steps);
  const meta = [
    i18n.t('export.stepsCount', [String(actionSteps(steps).length)]),
    i18n.t('export.createdLabel', [formatDate(guide.createdAt)]),
    ...(domain ? [i18n.t('export.sourceLabel', [domain])] : []),
  ].join(' · ');

  const lines: string[] = [`# ${sanitizeGuideTitle(guide.title)}`, ''];
  if (guide.description) lines.push(guide.description, '');
  lines.push(`*${meta}*`, '', '---', '');

  for (const step of steps) {
    if (isBlock(step)) {
      lines.push(...blockLines(step), '');
      continue;
    }

    const num = String(numbers.get(step.id) ?? 0).padStart(2, '0');
    lines.push(`## ${i18n.t('export.stepLabel', [num])}: ${step.description}`, '');

    const screenshot = screenshots.get(step.id);
    if (screenshot) {
      const rendered = await renderScreenshot(screenshot);
      const b64 = await blobToBase64(rendered);
      const altText = screenshot.edits?.alt || i18n.t('export.stepLabel', [num]);
      lines.push(`![${altText}](data:${rendered.type};base64,${b64})`, '');
    }
  }

  return lines.join('\n');
}
