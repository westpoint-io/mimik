import type { Guide, Step } from '@mimik/core/guides/types';
import { describe, expect, it, vi } from 'vitest';

const STEPS: Record<string, Partial<Step>[]> = {
  site: [{ url: 'https://www.github.com/a' }, { url: 'https://github.com/b' }, { url: 'https://docs.rs/c' }],
  app: [{ url: '' }, { app: { name: 'File Explorer' } }],
  none: [{}],
};

vi.mock('@mimik/core/guides/service', () => ({
  getFirstScreenshot: async () => null,
  getStepsForGuide: async (id: string) => STEPS[id],
}));

import { loadCardData } from '../load-card-data';

describe('loadCardData', () => {
  it("names a card after the guide's most common site, then its application, else nothing", async () => {
    const guides = Object.keys(STEPS).map((id) => ({ id }) as Guide);
    const { places } = await loadCardData(guides);
    expect(places.get('site')).toEqual({ kind: 'site', name: 'github.com' });
    expect(places.get('app')).toEqual({ kind: 'app', name: 'File Explorer' });
    expect(places.has('none')).toBe(false);
  });
});
