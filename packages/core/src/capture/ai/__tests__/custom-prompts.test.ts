import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/env')>()),
  client: vi.fn(() => 'extension'),
}));

import { client } from '@/core/env';
import { composePrompt, defaultPrompt, exampleBlocks, resolvePrompt, swapExamples } from '../custom-prompts';
import { resolveExamples } from '../examples';

beforeEach(() => vi.mocked(client).mockReturnValue('extension'));

describe('defaultPrompt', () => {
  it('has no placeholders in either section', () => {
    expect(defaultPrompt('steps', 'en')).not.toMatch(/\{\{/);
    expect(defaultPrompt('guide', 'en')).not.toMatch(/\{\{/);
  });

  it('writes out the examples for the language', () => {
    expect(defaultPrompt('steps', 'es')).toContain('Hacer clic en el botón Submit');
    expect(defaultPrompt('guide', 'fr')).toContain('Configurer les notifications Slack');
  });

  it('uses the desktop prompt and examples on the desktop', () => {
    vi.mocked(client).mockReturnValue('desktop');
    const prompt = defaultPrompt('steps', 'es');
    expect(prompt).toContain('desktop application');
    expect(prompt).toContain(resolveExamples('es').screenSteps[0]);
  });
});

describe('swapExamples', () => {
  it('replaces original examples and keeps other edits', () => {
    const edited = `${defaultPrompt('steps', 'en')}\n\nBe brief.`;
    const swapped = swapExamples('steps', edited, 'es');
    expect(swapped).toContain('Hacer clic en el botón Submit');
    expect(swapped).not.toContain('Click the Submit button');
    expect(swapped).toContain('Be brief.');
  });

  it('leaves rewritten examples alone', () => {
    const own = 'Examples:\n- Press the big button';
    expect(swapExamples('steps', own, 'es')).toBe(own);
  });

  it('swaps both guide lists', () => {
    const swapped = swapExamples('guide', defaultPrompt('guide', 'en'), 'de');
    for (const block of exampleBlocks('guide', 'de')) expect(swapped).toContain(block);
  });
});

describe('resolvePrompt', () => {
  it.each([undefined, {}, { steps: {} }, { steps: { prompt: '   ' } }, { steps: { prompt: 7 as never } }])(
    'falls back to the default for %j',
    (stored) => {
      expect(resolvePrompt('steps', stored, 'en')).toBe(defaultPrompt('steps', 'en'));
    },
  );

  it('uses a saved prompt', () => {
    expect(resolvePrompt('steps', { steps: { prompt: 'Mine' } }, 'en')).toBe('Mine');
  });
});

describe('composePrompt', () => {
  it('sends data, prompt, instructions, then language', () => {
    const sent = composePrompt('steps', { steps: { prompt: 'PROMPT', instructions: 'RULES' } }, 'es', 'DATA');
    const order = ['DATA', 'PROMPT', 'RULES', 'IMPORTANTE'].map((part) => sent.indexOf(part));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('never leaves the language line against the data', () => {
    const sent = composePrompt('guide', undefined, 'ja', 'DATA');
    const beforeLanguage = sent.slice(0, sent.indexOf('重要')).trimEnd();
    expect(beforeLanguage.endsWith('DATA')).toBe(false);
    expect(sent.startsWith('Steps:\nDATA')).toBe(true);
  });

  it('adds no instructions block when there are none', () => {
    expect(composePrompt('steps', undefined, 'en', 'DATA')).not.toContain('Additional instructions');
  });

  it('does not let data act as a replacement pattern', () => {
    expect(composePrompt('guide', undefined, 'en', 'Click $& then $`')).toContain('Click $& then $`');
  });

  it('caps stored instructions at the limit', () => {
    const sent = composePrompt('steps', { steps: { instructions: 'x'.repeat(600) } }, 'en', 'DATA');
    expect(sent).toContain('x'.repeat(500));
    expect(sent).not.toContain('x'.repeat(501));
  });
});
