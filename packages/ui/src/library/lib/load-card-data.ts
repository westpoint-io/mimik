import { getMostCommonDomain } from '@mimik/core/guides/domain';
import { getFirstScreenshot, getStepsForGuide } from '@mimik/core/guides/service';
import type { Guide, Screenshot, Step } from '@mimik/core/guides/types';
import type { GuidePlace } from '../types';

function placeOf(steps: Step[]): GuidePlace | null {
  const domain = getMostCommonDomain(steps);
  if (domain) return { kind: 'site', name: domain };
  const app = steps.find((step) => step.app?.name)?.app;
  return app ? { kind: 'app', name: app.name, id: app.id } : null;
}

export async function loadCardData(
  guides: Guide[],
): Promise<{ thumbnails: Map<string, Screenshot>; places: Map<string, GuidePlace> }> {
  const thumbnails = new Map<string, Screenshot>();
  const places = new Map<string, GuidePlace>();
  for (const guide of guides) {
    const [screenshot, steps] = await Promise.all([getFirstScreenshot(guide.id), getStepsForGuide(guide.id)]);
    if (screenshot) thumbnails.set(guide.id, screenshot);
    const place = placeOf(steps);
    if (place) places.set(guide.id, place);
  }
  return { thumbnails, places };
}
