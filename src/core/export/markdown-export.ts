import { i18n } from '#imports';
import { blobToBase64, extractDomain, formatDate } from '@/core/export/utils';
import type { Guide, Screenshot, Step } from '@/core/guides/types';

export async function exportGuideAsMarkdown(
  guide: Guide,
  steps: Step[],
  screenshots: Map<string, Screenshot>,
): Promise<string> {
  const domain = extractDomain(steps);
  const meta = [
    i18n.t('export.stepsCount', [String(steps.length)]),
    i18n.t('export.createdLabel', [formatDate(guide.createdAt)]),
    ...(domain ? [i18n.t('export.sourceLabel', [domain])] : []),
  ].join(' · ');

  const lines: string[] = [`# ${guide.title}`, '', `*${meta}*`, '', '---', ''];

  for (const step of steps) {
    const num = String(step.index + 1).padStart(2, '0');
    lines.push(`## ${i18n.t('export.stepLabel', [num])}: ${step.description}`, '');

    const screenshot = screenshots.get(step.id);
    if (screenshot) {
      const b64 = await blobToBase64(screenshot.blob);
      lines.push(`![${i18n.t('export.stepLabel', [num])}](data:${screenshot.mimeType};base64,${b64})`, '');
    }
  }

  return lines.join('\n');
}

export interface MarkdownBundleFile {
  filename: string;
  blob: Blob;
}

export async function exportGuideAsMarkdownBundle(
  guide: Guide,
  steps: Step[],
  screenshots: Map<string, Screenshot>,
): Promise<{ markdown: string; files: MarkdownBundleFile[] }> {
  const domain = extractDomain(steps);
  const meta = [
    i18n.t('export.stepsCount', [String(steps.length)]),
    i18n.t('export.createdLabel', [formatDate(guide.createdAt)]),
    ...(domain ? [i18n.t('export.sourceLabel', [domain])] : []),
  ].join(' · ');

  const lines: string[] = [`# ${guide.title}`, '', `*${meta}*`, '', '---', ''];
  const files: MarkdownBundleFile[] = [];

  for (const step of steps) {
    const num = String(step.index + 1).padStart(2, '0');
    lines.push(`## ${i18n.t('export.stepLabel', [num])}: ${step.description}`, '');

    const screenshot = screenshots.get(step.id);
    if (screenshot) {
      const ext = screenshot.mimeType === 'image/png' ? 'png' : 'jpg';
      const imageFilename = `images/step-${num}.${ext}`;
      lines.push(`![${i18n.t('export.stepLabel', [num])}](${imageFilename})`, '');
      files.push({ filename: imageFilename, blob: screenshot.blob });
    }
  }

  return { markdown: lines.join('\n'), files };
}
