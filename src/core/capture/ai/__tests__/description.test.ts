import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import type { DOMContext } from '../../dom/context';
import { getAIDescription } from '../description';

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

function completion(content: string) {
  return new Response(
    JSON.stringify({
      id: 'chatcmpl-1',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 80, completion_tokens: 9 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

beforeEach(() => {
  fakeBrowser.reset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getAIDescription over openrouter', () => {
  it('asks openrouter for the description and returns what it says', async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion('Click the Update profile button'));
    vi.stubGlobal('fetch', fetchMock);

    const description = await getAIDescription(DOM_CONTEXT, 'openrouter', 'openai/gpt-4o-mini', 'sk-or-key');

    expect(description).toBe('Click the Update profile button');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer sk-or-key');
  });

  it('sends the serialized dom context, not a screenshot', async () => {
    const fetchMock = vi.fn().mockResolvedValue(completion('Click Update profile'));
    vi.stubGlobal('fetch', fetchMock);

    await getAIDescription(DOM_CONTEXT, 'openrouter', 'openai/gpt-4o-mini', 'sk-or-key');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const prompt = JSON.stringify(body.messages);
    expect(body.model).toBe('openai/gpt-4o-mini');
    expect(prompt).toContain('Public profile');
    expect(prompt).toContain('/settings/profile');
    expect(prompt).not.toContain('image_url');
  });

  it('honours the stored ai language', async () => {
    await fakeBrowser.storage.local.set({ aiLanguage: 'fr' });
    const fetchMock = vi.fn().mockResolvedValue(completion('Cliquez sur Mettre à jour'));
    vi.stubGlobal('fetch', fetchMock);

    await getAIDescription(DOM_CONTEXT, 'openrouter', 'openai/gpt-4o-mini', 'sk-or-key');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(JSON.stringify(body.messages)).toContain('French');
  });

  it('strips the quotes a model wraps its answer in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(completion('"Click the Update profile button"')));
    expect(await getAIDescription(DOM_CONTEXT, 'openrouter', 'openai/gpt-4o-mini', 'sk-or-key')).toBe(
      'Click the Update profile button',
    );
  });

  it('falls back to null when openrouter rejects the key, instead of throwing into capture', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'No auth credentials found' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    expect(await getAIDescription(DOM_CONTEXT, 'openrouter', 'openai/gpt-4o-mini', 'sk-or-bad')).toBeNull();
  });
});
