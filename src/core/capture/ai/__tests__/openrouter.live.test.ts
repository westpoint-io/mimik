/**
 * Live check against the real OpenRouter API. Skipped unless OPENROUTER_API_KEY
 * is set, so `pnpm test` stays offline by default:
 *
 *   OPENROUTER_API_KEY=sk-or-... pnpm vitest run openrouter.live
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import type { DOMContext } from '../../dom/context';
import { getAIDescription } from '../description';
import { AI_PROVIDERS } from '../models';
import { validateApiKey } from '../validate';

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || AI_PROVIDERS.openrouter.defaultModel;

const DOM_CONTEXT: DOMContext = {
  page: { title: 'Public profile - Settings', path: '/settings/profile' },
  container: { tag: 'form', role: null, label: 'Public profile' },
  heading: 'Public profile',
  siblings: [
    { tag: 'input', role: null, name: 'Name', value: null },
    { tag: 'input', role: null, name: 'Email', value: null },
    { tag: 'button', role: null, name: 'Update profile', value: null },
  ],
  target: { tag: 'button', role: null, name: 'Update profile', value: null, action: 'click' },
};

describe.skipIf(!API_KEY)('openrouter, against the live API', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('accepts a real key', async () => {
    expect(await validateApiKey('openrouter', API_KEY as string)).toEqual({ valid: true });
  }, 20_000);

  it('rejects a key that is not real', async () => {
    expect(await validateApiKey('openrouter', 'sk-or-v1-not-a-real-key')).toEqual({
      valid: false,
      reason: 'rejected',
    });
  }, 20_000);

  it('describes a step in one short sentence', async () => {
    const description = await getAIDescription(DOM_CONTEXT, 'openrouter', MODEL, API_KEY as string);
    expect(description).toBeTruthy();
    expect((description as string).length).toBeLessThan(120);
    // console.* is silenced in vitest.setup.ts, so write straight to stdout.
    process.stdout.write(`\n  [openrouter:${MODEL}] ${description}\n`);
  }, 30_000);
});
