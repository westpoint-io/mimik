import { loadBranding } from '@/core/export/branding';
import { type ExportOptions, GIF_SPECS, type GifSpec, loadExportOptions } from '@/core/export/options';
import { isBlock } from '@/core/guides/blocks';
import type { Guide, Screenshot, Step } from '@/core/guides/types';
import { logger } from '@/core/logger';
import { composeGuideFrames, totalStepFrames } from './video-export';
import { FRAME_HEIGHT, FRAME_WIDTH } from './video-support';

const GIF_MAX_COLORS = 128;
const GIF_MIN_DELAY_MS = 20;
const GIF_YIELD_EVERY = 8;

export type GifOptions = Pick<ExportOptions, 'cover' | 'stepDescriptions' | 'gifQuality'>;

export interface GifExportControls {
  onProgress?: (encoded: number, frames: number) => void;
  signal?: AbortSignal;
}

export interface GifExportResult {
  blob: Blob;
  extension: 'gif';
}

export function gifDelayMs(durationSec: number): number {
  return Math.max(GIF_MIN_DELAY_MS, Math.round(durationSec * 100) * 10);
}

function gifFrameCount(steps: Step[], screenshots: Map<string, Screenshot>, cover: boolean, spec: GifSpec): number {
  const frames = steps.filter((step) => isBlock(step) || screenshots.has(step.id));
  return frames.length === 0 ? 0 : totalStepFrames(frames.length, spec.fps) + (cover ? 2 : 0);
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export async function exportGuideAsGif(
  guide: Guide,
  steps: Step[],
  screenshots: Map<string, Screenshot>,
  exportOptions?: GifOptions,
  controls: GifExportControls = {},
): Promise<GifExportResult> {
  const frames = steps.filter((step) => isBlock(step) || screenshots.has(step.id));
  if (frames.length === 0) throw new Error('This guide has no screenshots to turn into a GIF');

  const { GIFEncoder, applyPalette, quantize } = await import('gifenc');

  const [brand, options] = await Promise.all([
    loadBranding(),
    exportOptions ? Promise.resolve(exportOptions) : loadExportOptions(),
  ]);

  const spec = GIF_SPECS[options.gifQuality] ?? GIF_SPECS.medium;
  const canvas = new OffscreenCanvas(spec.width, spec.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.scale(spec.width / FRAME_WIDTH, spec.height / FRAME_HEIGHT);

  const total = gifFrameCount(steps, screenshots, Boolean(options.cover), spec);
  logger.info('[gif] encoding', { steps: frames.length, frames: total, ...spec });

  const gif = GIFEncoder();
  let written = 0;

  await composeGuideFrames(
    guide,
    frames,
    screenshots,
    options,
    brand,
    ctx,
    { width: spec.width, height: spec.height },
    async (_at, duration) => {
      const { data } = ctx.getImageData(0, 0, spec.width, spec.height);
      const palette = quantize(data, GIF_MAX_COLORS);
      gif.writeFrame(applyPalette(data, palette), spec.width, spec.height, {
        palette,
        delay: gifDelayMs(duration),
        ...(written === 0 ? { repeat: 0 } : {}),
      });
      written += 1;
      if (written % GIF_YIELD_EVERY === 0) await yieldToEventLoop();
    },
    controls,
    spec.fps,
  );

  gif.finish();
  const blob = new Blob([gif.bytes() as BlobPart], { type: 'image/gif' });
  logger.info('[gif] encoded', { frames: written, bytes: blob.size });
  return { blob, extension: 'gif' };
}
