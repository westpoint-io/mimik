import { describe, expect, it } from 'vitest';
import { buildFallbackDescription } from '../step-description';
import { namingCases } from './naming-corpus';

describe('step titles read the same after the naming rewrite', () => {
  it('names 6000 generated controls exactly as before', async () => {
    const titles = namingCases(6000, 3).map(({ action, meta, typed }) => buildFallbackDescription(action, meta, typed));
    await expect(JSON.stringify(titles, null, 0)).toMatchFileSnapshot('./__snapshots__/naming-titles.json');
  });
});
