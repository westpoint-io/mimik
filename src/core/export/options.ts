import type { BundleUrlMode } from '@/core/transfer/bundle';
import { localStorage } from '@/lib/browser-api';

export type { BundleUrlMode };

export type ImageScale = 'small' | 'medium' | 'large';

export const IMAGE_SCALE_FACTORS: Record<ImageScale, number> = {
  small: 0.55,
  medium: 0.78,
  large: 1,
};

export type VideoResolution = '720p' | '1080p';

export const VIDEO_RESOLUTIONS: VideoResolution[] = ['720p', '1080p'];

export type GifQuality = 'low' | 'medium' | 'high';

export interface GifSpec {
  width: number;
  height: number;
  fps: number;
}

export const GIF_SPECS: Record<GifQuality, GifSpec> = {
  low: { width: 320, height: 180, fps: 8 },
  medium: { width: 480, height: 270, fps: 10 },
  high: { width: 640, height: 360, fps: 15 },
};

export const GIF_QUALITIES: GifQuality[] = ['low', 'medium', 'high'];

export const BUNDLE_URL_MODES: BundleUrlMode[] = ['origin', 'path', 'full'];

export interface ExportOptions {
  cover: boolean;
  screenshots: boolean;
  stepUrls: boolean;
  imageScale: ImageScale;
  stepDescriptions: boolean;
  resolution: VideoResolution;
  gifQuality: GifQuality;
  bundleStripInputs: boolean;
  bundleUrls: BundleUrlMode;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  cover: true,
  screenshots: true,
  stepUrls: true,
  imageScale: 'medium',
  stepDescriptions: true,
  resolution: '720p',
  gifQuality: 'medium',
  bundleStripInputs: true,
  bundleUrls: 'path',
};

const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

export function normaliseExportOptions(value: unknown): ExportOptions {
  if (!value || typeof value !== 'object') return { ...DEFAULT_EXPORT_OPTIONS };
  const raw = value as Partial<ExportOptions>;
  return {
    cover: bool(raw.cover, DEFAULT_EXPORT_OPTIONS.cover),
    screenshots: bool(raw.screenshots, DEFAULT_EXPORT_OPTIONS.screenshots),
    stepUrls: bool(raw.stepUrls, DEFAULT_EXPORT_OPTIONS.stepUrls),
    imageScale:
      raw.imageScale && raw.imageScale in IMAGE_SCALE_FACTORS ? raw.imageScale : DEFAULT_EXPORT_OPTIONS.imageScale,
    stepDescriptions: bool(raw.stepDescriptions, DEFAULT_EXPORT_OPTIONS.stepDescriptions),
    resolution: VIDEO_RESOLUTIONS.includes(raw.resolution as VideoResolution)
      ? (raw.resolution as VideoResolution)
      : DEFAULT_EXPORT_OPTIONS.resolution,
    gifQuality: raw.gifQuality && raw.gifQuality in GIF_SPECS ? raw.gifQuality : DEFAULT_EXPORT_OPTIONS.gifQuality,
    bundleStripInputs: bool(raw.bundleStripInputs, DEFAULT_EXPORT_OPTIONS.bundleStripInputs),
    bundleUrls: BUNDLE_URL_MODES.includes(raw.bundleUrls as BundleUrlMode)
      ? (raw.bundleUrls as BundleUrlMode)
      : DEFAULT_EXPORT_OPTIONS.bundleUrls,
  };
}

export async function loadExportOptions(): Promise<ExportOptions> {
  const stored = await localStorage.get(['exportOptions']);
  return normaliseExportOptions(stored.exportOptions);
}

export async function saveExportOptions(options: ExportOptions): Promise<void> {
  await localStorage.set({ exportOptions: options });
}
