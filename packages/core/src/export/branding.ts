import { assetUrl, localStorage } from '@/core/env';
import { blobToDataUrl } from '@/core/export/utils';
import { normalizeHex } from '@/core/screenshot/color';
import { DEFAULT_TARGET_COLOR, TARGET_COLORS } from '@/core/screenshot/types';

const BRAND_LOGO_MAX_WIDTH = 320;
const FALLBACK_LOGO_PATH = '/mimik-mark.png';

export const DEFAULT_BRAND_COLOR = '#1E1B4B';

export const BRAND_COLORS = [DEFAULT_BRAND_COLOR, ...TARGET_COLORS] as const;

export const defaultFooterLine = () => `© ${new Date().getFullYear()}`;

export interface BrandLogo {
  dataUrl: string;
  width: number;
  height: number;
}

export interface Branding {
  logo: BrandLogo | null;
  footer: string;
  attribution: boolean;
  accent: string;
  custom: boolean;
}

function parseLogo(value: unknown): BrandLogo | null {
  if (!value || typeof value !== 'object') return null;
  const { dataUrl, width, height } = value as Partial<BrandLogo>;
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) return null;
  return { dataUrl, width, height };
}

async function loadFallbackLogo(): Promise<BrandLogo | null> {
  try {
    const response = await fetch(assetUrl(FALLBACK_LOGO_PATH));
    if (!response.ok) return null;
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const logo = { dataUrl: await blobToDataUrl(blob), width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return logo;
  } catch {
    return null;
  }
}

export function brandColorFrom(stored: { brandColor?: unknown; targetColor?: unknown }): string {
  const hex = (value: unknown) => (typeof value === 'string' && normalizeHex(value)) || null;
  const legacy = hex(stored.targetColor);
  return hex(stored.brandColor) ?? (legacy && legacy !== DEFAULT_TARGET_COLOR ? legacy : DEFAULT_BRAND_COLOR);
}

export async function loadBranding(): Promise<Branding> {
  const stored = await localStorage.get(['brandLogo', 'brandFooter', 'brandAttribution', 'brandColor', 'targetColor']);
  const accent = brandColorFrom(stored);
  return {
    logo: parseLogo(stored.brandLogo) ?? (await loadFallbackLogo()),
    footer: typeof stored.brandFooter === 'string' ? stored.brandFooter.trim() : defaultFooterLine(),
    attribution: stored.brandAttribution !== false,
    accent,
    custom: accent !== DEFAULT_BRAND_COLOR,
  };
}

export function fitLogo(logo: BrandLogo, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height, 1);
  return {
    width: Math.max(1, Math.round(logo.width * scale)),
    height: Math.max(1, Math.round(logo.height * scale)),
  };
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function makeBrandLogo(file: File): Promise<BrandLogo> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, BRAND_LOGO_MAX_WIDTH / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return { dataUrl: canvas.toDataURL('image/png'), width, height };
}
