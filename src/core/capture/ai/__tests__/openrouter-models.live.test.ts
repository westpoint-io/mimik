/**
 * Live check that every curated OpenRouter model actually answers.
 * Skipped unless OPENROUTER_API_KEY is set. Run with:
 *
 *   OPENROUTER_API_KEY=sk-or-... pnpm vitest run openrouter.live
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import type { DOMContext } from '../../dom/context';
import { getAIDescription } from '../description';
import { AI_PROVIDERS } from '../models';

const API_KEY = process.env.OPENROUTER_API_KEY;

const DOM_CONTEXT: DOMContext = {
  page: { title: 'Public profile - Settings', path: '/settings/profile' },
  container: { tag: 'form', role: null, label: 'Public profile' },
  heading: 'Public profile',
  siblings: [
    { tag: 'input', role: null, name: 'Name', value: null },
    { tag: 'button', role: null, name: 'Update profile', value: null },
  ],
  target: { tag: 'button', role: null, name: 'Update profile', value: null, action: 'click' },
};

describe.skipIf(!API_KEY)('every curated openrouter model answers', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it.each(AI_PROVIDERS.openrouter.models.map((m) => m.id))('%s describes a step', async (id) => {
    const description = await getAIDescription(DOM_CONTEXT, 'openrouter', id, API_KEY as string);
    process.stdout.write(`\n  [${id}] ${description}\n`);
    expect(description).toBeTruthy();
  }, 45_000);
});
