import { afterEach, describe, expect, it, vi } from 'vitest';
import { createModel, OPENROUTER_BASE_URL } from '../provider';

function chatCompletion() {
  return new Response(
    JSON.stringify({
      id: 'chatcmpl-1',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Click Save' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createModel', () => {
  it('keeps openai on its own provider', () => {
    expect(createModel('openai', 'gpt-4o-mini', 'sk-key').provider).toBe('openai.responses');
  });

  it('keeps anthropic on its own provider', () => {
    expect(createModel('anthropic', 'claude-3-5-haiku-20241022', 'ant-key').provider).toBe('anthropic.messages');
  });

  it('falls back to openai for a provider it does not know', () => {
    expect(createModel('mystery', 'gpt-4o-mini', 'sk-key').provider).toBe('openai.responses');
  });

  it('routes openrouter through chat completions, not the responses API', () => {
    expect(createModel('openrouter', 'openai/gpt-4o-mini', 'sk-or-key').provider).toBe('openrouter.chat');
  });

  it('passes an openrouter model id through untouched', () => {
    expect(createModel('openrouter', 'anthropic/claude-3.5-haiku', 'sk-or-key').modelId).toBe(
      'anthropic/claude-3.5-haiku',
    );
  });

  it('sends an openrouter request to openrouter, bearing the key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatCompletion());
    vi.stubGlobal('fetch', fetchMock);

    await createModel('openrouter', 'openai/gpt-4o-mini', 'sk-or-key').doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'describe this step' }] }],
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${OPENROUTER_BASE_URL}/chat/completions`);
    expect(init.headers.authorization).toBe('Bearer sk-or-key');
    expect(JSON.parse(init.body).model).toBe('openai/gpt-4o-mini');
  });
});
