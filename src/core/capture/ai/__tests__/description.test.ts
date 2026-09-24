import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateTextMock } = vi.hoisted(() => ({ generateTextMock: vi.fn() }));

vi.mock('ai', () => ({ generateText: generateTextMock }));

vi.mock('../provider', () => ({ createModel: () => ({ id: 'test-model' }) }));

vi.mock('@/lib/browser-api', () => ({
  localStorage: { get: vi.fn().mockResolvedValue({ aiLanguage: 'en' }) },
}));

import { localStorage } from '@/lib/browser-api';
import type { DOMContext } from '../../dom/context';
import { getAIDescription } from '../description';

function makeContext(overrides: Partial<DOMContext> = {}): DOMContext {
  return {
    page: { title: 'Settings', path: '/settings' },
    container: null,
    heading: null,
    siblings: [],
    target: { tag: 'button', role: null, name: 'Update profile', value: null, action: 'click' },
    ...overrides,
  };
}

async function promptFor(aiLanguage: string, context = makeContext()): Promise<string> {
  vi.mocked(localStorage.get).mockResolvedValue({ aiLanguage });
  await getAIDescription(context, 'openai', 'gpt-4o-mini', 'key');
  return generateTextMock.mock.calls[0][0].prompt as string;
}

describe('getAIDescription', () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    generateTextMock.mockResolvedValue({ text: 'Click Update profile' });
    vi.mocked(localStorage.get).mockResolvedValue({ aiLanguage: 'en' });
  });

  it('leaves no placeholder unfilled', async () => {
    expect(await promptFor('en')).not.toMatch(/\{\{\w+\}\}/);
  });

  it('gives the model examples in the configured language', async () => {
    const prompt = await promptFor('fr');
    expect(prompt).toContain('Cliquer sur le bouton Submit');
    expect(prompt).not.toContain('Click the Submit button');
  });

  it('writes the language instruction in that language too', async () => {
    expect(await promptFor('de')).toContain('WICHTIG');
  });

  it('appends no language instruction for English', async () => {
    expect(await promptFor('en')).not.toContain('IMPORTANT: Write the output in');
  });

  it('does not let page text act as a replacement pattern', async () => {
    const prompt = await promptFor('en', makeContext({ page: { title: 'Save $& and $` now', path: '/x' } }));
    expect(prompt).toContain('Save $& and $` now');
  });
});
