import { getScreenshotsForSteps } from '@mimik/core/guides/service';
import type { Screenshot, Snapshot } from '@mimik/core/guides/types';
import type { PreviewData } from '../types';

export async function buildPreview(snapshot: Snapshot): Promise<PreviewData> {
  const rows = new Map(snapshot.screenshots.map((row) => [row.id, row]));
  const steps = [...snapshot.steps].sort((a, b) => a.index - b.index);
  const wanted = steps.map((s) => s.screenshotId).filter((id): id is string => !!id && rows.has(id));
  const live = await getScreenshotsForSteps(wanted);
  const blobs = new Map([...live.values()].map((row) => [row.id, row.blob]));
  const screenshots = new Map<string, Screenshot>();
  for (const step of steps) {
    const row = step.screenshotId ? rows.get(step.screenshotId) : undefined;
    const blob = row ? blobs.get(row.id) : undefined;
    if (row && blob) screenshots.set(step.id, { ...row, blob });
  }
  return { snapshotId: snapshot.id, steps, screenshots };
}
