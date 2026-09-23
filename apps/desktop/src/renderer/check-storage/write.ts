import { addStepToGuide, createGuide, createSnapshot, createStep, saveScreenshot } from '@mimik/core/guides/service';
import type { CheckResult } from './types';

export async function write(guideId: string): Promise<CheckResult> {
  const stepId = `${guideId}-step`;
  const screenshotId = `${guideId}-shot`;

  await createGuide(guideId);
  await saveScreenshot({
    id: screenshotId,
    stepId,
    blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
    mimeType: 'image/png',
    width: 2,
    height: 2,
  });
  await createStep({
    id: stepId,
    guideId,
    index: 0,
    description: 'Click Save',
    action: 'click',
    url: '',
    app: { name: 'Mimik Desktop' },
    window: { title: 'Storage check' },
    timestamp: Date.now(),
    screenshotId,
  });
  await addStepToGuide(guideId, stepId);
  const snapshot = await createSnapshot(guideId);

  return {
    name: 'write through @mimik/core',
    ok: snapshot !== null,
    detail: snapshot
      ? `guide, step, screenshot and snapshot ${snapshot.id.slice(0, 8)} stored`
      : 'snapshot not created',
  };
}
