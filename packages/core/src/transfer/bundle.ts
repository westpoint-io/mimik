import { strToU8, zipSync } from 'fflate';
import { extractDomain } from '@/core/export/utils';
import type { Guide, Screenshot, Step } from '@/core/guides/types';
import { flattenScreenshot } from './flatten';
import {
  BUNDLE_MIME,
  BUNDLE_VERSION,
  type BundleManifest,
  type BundleScreenshot,
  type BundleStep,
  MANIFEST_PATH,
  README_PATH,
  SCREENSHOT_DIR,
} from './schema';
import { scrubValues, typedValues } from './scrub';

export type BundleUrlMode = 'full' | 'path' | 'origin';

export interface BundleOptions {
  stripInputValues: boolean;
  urls: BundleUrlMode;
}

export const DEFAULT_BUNDLE_OPTIONS: BundleOptions = {
  stripInputValues: true,
  urls: 'path',
};

export function trimUrl(url: string, mode: BundleUrlMode): string {
  if (mode === 'full' || !url) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return '';
  }
  if (parsed.origin === 'null') return url;
  return mode === 'origin' ? parsed.origin : `${parsed.origin}${parsed.pathname}`;
}

function bundleStep(step: Step, options: BundleOptions, secrets: readonly string[]): BundleStep {
  const { guideId: _guideId, aiPending: _aiPending, screenshotId: _screenshotId, ...rest } = step;
  const travelling: BundleStep = { ...rest, url: trimUrl(step.url, options.urls) };

  if (options.stripInputValues) {
    delete travelling.inputValue;
    travelling.description = scrubValues(travelling.description, secrets);
  }

  if (travelling.elementMeta) {
    const meta = travelling.elementMeta;
    const ownText = options.stripInputValues && step.inputValue ? null : meta.textContent;
    travelling.elementMeta = {
      ...meta,
      href: meta.href ? trimUrl(meta.href, options.urls) : null,
      textContent: ownText && options.stripInputValues ? scrubValues(ownText, secrets) : ownText,
    };
  }

  return travelling;
}

export async function exportGuideAsBundle(
  guide: Guide,
  steps: Step[],
  screenshots: Map<string, Screenshot>,
  options: BundleOptions = DEFAULT_BUNDLE_OPTIONS,
): Promise<Blob> {
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
  const manifestScreenshots: BundleScreenshot[] = [];
  let anyRedaction = false;

  for (const step of steps) {
    const screenshot = screenshots.get(step.id);
    if (!screenshot) continue;

    const { meta, blob, redacted } = await flattenScreenshot(screenshot);
    anyRedaction ||= redacted;

    const file = `${SCREENSHOT_DIR}/${meta.id}.webp`;
    files[file] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];

    manifestScreenshots.push({
      id: meta.id,
      stepId: meta.stepId,
      file,
      mimeType: meta.mimeType,
      width: meta.width,
      height: meta.height,
      ...(meta.bounds ? { bounds: meta.bounds } : {}),
      ...(meta.pixelRatio !== undefined ? { pixelRatio: meta.pixelRatio } : {}),
      ...(meta.clickPoint ? { clickPoint: meta.clickPoint } : {}),
      ...(meta.edits ? { edits: meta.edits } : {}),
    });
  }

  const secrets = options.stripInputValues ? typedValues(steps) : [];
  const scrub = (text: string) => (options.stripInputValues ? scrubValues(text, secrets) : text);

  const manifest: BundleManifest = {
    version: BUNDLE_VERSION,
    exportedAt: Date.now(),
    guide: {
      title: scrub(guide.title),
      ...(guide.description ? { description: scrub(guide.description) } : {}),
      createdAt: guide.createdAt,
    },
    sourceDomain: extractDomain(steps),
    redacted: {
      screenshots: anyRedaction,
      inputValues: options.stripInputValues,
      urls: options.urls,
    },
    steps: steps.map((step) => bundleStep(step, options, secrets)),
    screenshots: manifestScreenshots,
  };

  files[MANIFEST_PATH] = strToU8(JSON.stringify(manifest, null, 2));

  const { exportGuideAsMarkdown } = await import('@/core/export/markdown-export');
  const readmeGuide: Guide = {
    ...guide,
    title: manifest.guide.title,
    ...(guide.description ? { description: scrub(guide.description) } : {}),
  };
  const readmeSteps = steps.map((step) => ({ ...step, description: scrub(step.description) }));
  files[README_PATH] = strToU8(await exportGuideAsMarkdown(readmeGuide, readmeSteps, screenshots));

  const zipped = zipSync(files);
  return new Blob([zipped as unknown as BlobPart], { type: BUNDLE_MIME });
}
