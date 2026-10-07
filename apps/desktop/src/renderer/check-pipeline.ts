import './core-env';
import type { CaptureStepData } from '@mimik/core/capture/sink';
import { assetUrl } from '@mimik/core/env';
import { exportGuideAsDOCX } from '@mimik/core/export/docx-export';
import { exportGuideAsHTML } from '@mimik/core/export/html-export';
import { exportGuideAsMarkdown } from '@mimik/core/export/markdown-export';
import { exportGuideAsPDF } from '@mimik/core/export/pdf-export';
import { allScreenshotIds, getGuide, importGuide, permanentlyDeleteGuide } from '@mimik/core/guides/service';
import { elementSource } from '@mimik/core/guides/types';
import { resolveViewport } from '@mimik/core/screenshot/geometry';
import { exportGuideAsBundle } from '@mimik/core/transfer/bundle';
import { readBundle } from '@mimik/core/transfer/parse';
import { DesktopCaptureSink } from './capture-sink';

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const sink = new DesktopCaptureSink();

window.mimik.onRequest('mimik:capture:createGuide', () => sink.createGuide());
window.mimik.onRequest('mimik:capture:captureStep', (payload) => sink.captureStep(payload as CaptureStepData));

window.mimik.onRequest('mimik:check:screenshotSrc', async (payload) => {
  const found = await getGuide(payload as string);
  const first = found ? [...found.screenshots.values()][0] : undefined;
  return first?.src ?? null;
});

window.mimik.onRequest('mimik:check:screenshotIds', () => allScreenshotIds());

window.mimik.onRequest('mimik:check:defaultLogo', () =>
  fetch(assetUrl('/mimik-mark.png'))
    .then((response) => response.ok)
    .catch(() => false),
);

window.mimik.onRequest('mimik:check:cleanup', async (payload) => {
  for (const id of payload as string[]) await permanentlyDeleteGuide(id);
  return true;
});

window.mimik.onRequest('mimik:check:steps', async (payload) => {
  const found = await getGuide(payload as string);
  return found ? found.steps.map((step) => step.description) : null;
});

window.mimik.onRequest('mimik:check:trashed', async (payload) => {
  const found = await getGuide(payload as string);
  return found ? found.guide.deletedAt != null : null;
});

window.mimik.onRequest('mimik:check:title', async (payload) => {
  const found = await getGuide(payload as string);
  return found?.guide.title ?? null;
});

window.mimik.onRequest('mimik:check:verify', async (payload) => {
  const guideId = payload as string;
  const results: CheckResult[] = [];
  const found = await getGuide(guideId);

  if (!found) {
    return [{ name: 'guide in the library', ok: false, detail: 'guide not found' }];
  }

  const { guide, steps, screenshots } = found;
  const step = steps[0];
  const meta = step?.elementMeta;
  const shot = step ? screenshots.get(step.id) : undefined;

  results.push({
    name: 'steps land in the library',
    ok: steps.length === 2 && guide.stepIds.length === 2,
    detail: `${steps.length} step(s), ${guide.stepIds.length} id(s) on the guide`,
  });

  results.push({
    name: 'step carries screen provenance',
    ok: meta !== undefined && elementSource(meta) === 'screen',
    detail: meta
      ? `source ${elementSource(meta)}, app "${step.app?.name ?? 'none'}", window "${step.window?.title ?? 'none'}"`
      : 'no element metadata',
  });

  results.push({
    name: 'screenshot cropped to the region',
    ok: shot !== undefined && shot.blob.size > 0,
    detail: shot ? `${shot.width} × ${shot.height}, ${shot.blob.size} bytes` : 'no screenshot',
  });

  const viewport = shot ? resolveViewport(shot) : null;
  const zoom = shot && viewport ? shot.width / viewport.width : 0;
  results.push({
    name: 'a desktop step zooms without upscaling',
    ok:
      shot !== undefined &&
      shot.bounds === undefined &&
      viewport !== null &&
      viewport.x >= 0 &&
      viewport.y >= 0 &&
      viewport.x + viewport.width <= shot.width &&
      viewport.y + viewport.height <= shot.height &&
      zoom >= 1 &&
      zoom <= 5 &&
      (shot.edits?.zoomLevel ?? 0) >= 1 &&
      Math.abs((shot.edits?.zoomLevel ?? 0) * 4 - Math.round((shot.edits?.zoomLevel ?? 0) * 4)) < 1e-9 &&
      (shot.edits?.target?.width ?? 0) > 0,
    detail: shot
      ? `level ${shot.edits?.zoomLevel}, ${zoom.toFixed(2)}x — viewport ${viewport?.width} × ${viewport?.height} of ${shot.width} × ${shot.height}, inside the frame`
      : 'no screenshot',
  });

  results.push({
    name: 'description came from the shared heuristic',
    ok: (step?.description.length ?? 0) > 0 && step?.descriptionSource === 'heuristic',
    detail: `"${step?.description ?? ''}"`,
  });

  const exporters: [string, () => Promise<string | Blob>][] = [
    ['HTML', () => exportGuideAsHTML(guide, steps, screenshots)],
    ['Markdown', () => exportGuideAsMarkdown(guide, steps, screenshots)],
    ['PDF', () => exportGuideAsPDF(guide, steps, screenshots)],
    ['DOCX', () => exportGuideAsDOCX(guide, steps, screenshots)],
  ];

  try {
    const { canExportVideo } = await import('@mimik/core/export/video-support');
    if (!(await canExportVideo())) {
      results.push({ name: 'video export', ok: true, detail: 'n/a — this build encodes no video' });
    } else {
      const { exportGuideAsVideo } = await import('@mimik/core/export/video-export');
      const out = await exportGuideAsVideo(guide, steps, screenshots);
      const mime = out.blob.type;
      results.push({
        name: 'video export',
        ok: out.blob.size > 0 && mime === `video/${out.extension}` && out.chapters.length === steps.length,
        detail: `${out.blob.size} bytes, ${mime}, .${out.extension}, ${out.chapters.length} chapter(s)`,
      });
    }
  } catch (error) {
    results.push({
      name: 'video export',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  for (const [name, run] of exporters) {
    try {
      const output = await run();
      const size = typeof output === 'string' ? output.length : output.size;
      results.push({ name: `${name} export`, ok: size > 0, detail: `${size} bytes` });
    } catch (error) {
      results.push({
        name: `${name} export`,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    const imported = await getGuide(
      await importGuide(await readBundle(await exportGuideAsBundle(guide, steps, screenshots))),
    );
    const shots = imported ? [...imported.screenshots.values()] : [];
    results.push({
      name: 'a .mimik file round-trips',
      ok:
        imported?.steps.length === steps.length &&
        shots.length === screenshots.size &&
        shots.every((s) => s.blob.size > 0),
      detail: `${imported?.steps.length ?? 0} of ${steps.length} steps, ${shots.length} screenshot(s) back`,
    });
    if (imported) await permanentlyDeleteGuide(imported.guide.id);
  } catch (error) {
    results.push({
      name: 'a .mimik file round-trips',
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  return results;
});
