import { getGuide, permanentlyDeleteGuide } from '@mimik/core/guides/service';
import type { CheckResult } from './types';

export async function read(guideId: string): Promise<CheckResult> {
  const found = await getGuide(guideId);
  const step = found?.steps[0];
  const shot = found ? found.screenshots.get(step?.id ?? '') : undefined;
  const blobBytes = shot ? (await shot.blob.arrayBuffer()).byteLength : 0;
  await permanentlyDeleteGuide(guideId);

  return {
    name: 'read from a second window',
    ok: Boolean(found) && step?.app?.name === 'Mimik Desktop' && blobBytes === 4,
    detail: found
      ? `${found.steps.length} step, app "${step?.app?.name}", screenshot blob ${blobBytes} bytes`
      : 'guide not found',
  };
}
