import { i18n } from '@/core/env';
import type { Step } from '@/core/guides/types';

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return await blob.arrayBuffer();
}

export interface StepContext {
  label: string;
  href?: string;
}

function truncateLabel(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function stepContext(step: Step, max = 72): StepContext | null {
  if (step.url) {
    try {
      const parsed = new URL(step.url);
      const path = parsed.pathname === '/' ? '' : parsed.pathname;
      return { label: truncateLabel(`${parsed.hostname.replace(/^www\./, '')}${path}`, max), href: step.url };
    } catch {
      return { label: step.url, href: step.url };
    }
  }
  if (step.app) {
    const title = step.window?.title;
    return { label: truncateLabel(title ? `${step.app.name} — ${title}` : step.app.name, max) };
  }
  return null;
}

export function extractDomain(steps: Step[]): string | null {
  const stepWithUrl = steps.find((s) => s.url);
  if (!stepWithUrl) return null;
  try {
    return new URL(stepWithUrl.url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es',
  'pt-BR': 'pt-BR',
  fr: 'fr',
  de: 'de-DE',
  ru: 'ru-RU',
  'zh-CN': 'zh-CN',
};

export function formatDate(timestamp: number): string {
  let locale = 'en-US';
  try {
    const meta = i18n.t('meta.locale');
    if (meta && LOCALE_MAP[meta]) locale = LOCALE_MAP[meta];
  } catch {}
  return new Date(timestamp).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function fitImage(width: number, height: number, maxHeight: number): { width: number; height: number } {
  if (!Number.isFinite(height) || height <= 0 || height <= maxHeight) return { width, height };
  return { width: width * (maxHeight / height), height: maxHeight };
}

export const MAX_TITLE_LINES = 3;
export const MAX_DESC_LINES = 4;
export const MAX_LEAD_LINES = 2;

export function clampLines(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  kept[max - 1] = `${kept[max - 1].replace(/\s+$/, '')}…`;
  return kept;
}

export const LEAD_FONT_PX = 13;
export const LEAD_LINE_RATIO = 1.5;
export const LEAD_MARGIN_PX = 14;

export function pxToMm(px: number): number {
  return (px * 25.4) / 96;
}

export function containFit(
  srcWidth: number,
  srcHeight: number,
  boxWidth: number,
  boxHeight: number,
): { width: number; height: number; x: number; y: number } {
  if (!(srcWidth > 0) || !(srcHeight > 0)) return { width: boxWidth, height: boxHeight, x: 0, y: 0 };
  const scale = Math.min(boxWidth / srcWidth, boxHeight / srcHeight);
  const width = srcWidth * scale;
  const height = srcHeight * scale;
  return { width, height, x: (boxWidth - width) / 2, y: (boxHeight - height) / 2 };
}
