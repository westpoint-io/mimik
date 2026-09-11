import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchMock } = vi.hoisted(() => {
  const fn = vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>();
  return { fetchMock: fn };
});

vi.stubGlobal('fetch', fetchMock);

import { validateApiKey } from '../validate';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' }, ...init });
}

function errorResponse(status: number) {
  return new Response(null, { status });
}

function modelsBody(...ids: string[]) {
  return jsonResponse({ data: ids.map((id) => ({ id })) });
}

function chatOkBody() {
  const message = { content: 'OK' };
  return jsonResponse({ choices: [{ message }] });
}

describe('validateApiKey', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('returns valid for a good key', async () => {
    fetchMock.mockResolvedValueOnce(modelsBody('gpt-4o-mini'));
    expect(await validateApiKey('openai', 'sk-good')).toEqual({ valid: true, models: ['gpt-4o-mini'] });
  });

  it('returns rejected for a bad key', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(401));
    expect(await validateApiKey('openai', 'sk-bad')).toEqual({ valid: false, reason: 'rejected' });
  });

  it('returns rejected for anthropic bad key', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(403));
    expect(await validateApiKey('anthropic', 'bad')).toEqual({ valid: false, reason: 'rejected' });
  });

  it('returns network error for fetch failure', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await validateApiKey('openai', 'sk-good')).toEqual({ valid: false, reason: 'network' });
  });

  it('returns network error for non-ok non-auth status', async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500));
    expect(await validateApiKey('openai', 'sk-good')).toEqual({ valid: false, reason: 'network' });
  });

  it('returns valid for groq', async () => {
    fetchMock.mockResolvedValueOnce(modelsBody('ok-model'));
    expect(await validateApiKey('groq', 'gsk-key')).toEqual({ valid: true, models: ['ok-model'] });
  });

  it('returns valid for deepseek', async () => {
    fetchMock.mockResolvedValueOnce(modelsBody('deepseek-v4-flash'));
    expect(await validateApiKey('deepseek', 'sk-deepseek')).toEqual({ valid: true, models: ['deepseek-v4-flash'] });
  });

  it('checks a groq key against groq, not openai', async () => {
    fetchMock.mockResolvedValueOnce(modelsBody('ok-model'));
    expect(await validateApiKey('groq', 'gsk-key')).toEqual({ valid: true, models: ['ok-model'] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/models');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer gsk-key');
  });

  it('checks a deepseek key against deepseek, not openai', async () => {
    fetchMock.mockResolvedValueOnce(modelsBody('deepseek-v4-flash'));
    expect(await validateApiKey('deepseek', 'sk-deepseek')).toEqual({ valid: true, models: ['deepseek-v4-flash'] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.deepseek.com/models');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer sk-deepseek');
  });

  it('gives up rather than spinning forever when a host never answers', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null));
    await validateApiKey('openai', 'sk-key');
    const [, init] = fetchMock.mock.calls[0];
    expect(init!.signal).toBeInstanceOf(AbortSignal);
  });

  it('never sends a key to an unknown provider, and does not call it rejected', async () => {
    expect(await validateApiKey('mystery', 'secret')).toEqual({ valid: false, reason: 'network' });
  });

  describe('openai with custom base URL (inference probe)', () => {
    it('returns rejected when probe returns 401', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(401));
      expect(await validateApiKey('openai', 'bad-key', 'https://api.example.com/v1', 'selected-model')).toEqual({
        valid: false,
        reason: 'rejected',
      });
    });

    it('returns valid when probe succeeds', async () => {
      fetchMock.mockResolvedValueOnce(chatOkBody());
      fetchMock.mockResolvedValueOnce(modelsBody('public-model', 'selected-model'));
      expect(await validateApiKey('openai', 'sk-key', 'https://api.example.com/v1', 'selected-model')).toEqual({
        valid: true,
        models: ['public-model', 'selected-model'],
      });
    });

    it('strips trailing slashes from base URL', async () => {
      fetchMock.mockResolvedValueOnce(chatOkBody());
      fetchMock.mockResolvedValueOnce(modelsBody('model-a'));
      expect(await validateApiKey('openai', 'sk-key', 'https://api.example.com/v1///', 'selected-model')).toEqual({
        valid: true,
        models: ['model-a'],
      });
    });

    it('returns model-required when no model is given and catalog is reachable', async () => {
      fetchMock.mockResolvedValueOnce(modelsBody('public-model', 'selected-model'));
      expect(await validateApiKey('openai', 'sk-key', 'https://api.example.com/v1')).toEqual({
        valid: false,
        reason: 'model-required',
        models: ['public-model', 'selected-model'],
      });
    });

    it('returns model-required with no models when catalog fails', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
      expect(await validateApiKey('openai', 'sk-key', 'https://api.example.com/v1')).toEqual({
        valid: false,
        reason: 'model-required',
      });
    });

    it('returns model-required when model is blank', async () => {
      fetchMock.mockResolvedValueOnce(modelsBody('public-model', 'selected-model'));
      expect(await validateApiKey('openai', 'sk-key', 'https://api.example.com/v1', '  ')).toEqual({
        valid: false,
        reason: 'model-required',
        models: ['public-model', 'selected-model'],
      });
    });

    it('returns model-invalid when model is not in catalog', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(404));
      fetchMock.mockResolvedValueOnce(modelsBody('public-model', 'selected-model'));
      expect(await validateApiKey('openai', 'sk-key', 'https://api.example.com/v1', 'not-in-catalog')).toEqual({
        valid: false,
        reason: 'model-invalid',
        models: ['public-model', 'selected-model'],
      });
    });

    it('returns model-invalid when model is not in catalog (whitespace)', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(404));
      fetchMock.mockResolvedValueOnce(modelsBody('public-model', 'selected-model'));
      expect(await validateApiKey('openai', 'sk-key', 'https://api.example.com/v1', '  missing-model  ')).toEqual({
        valid: false,
        reason: 'model-invalid',
        models: ['public-model', 'selected-model'],
      });
    });

    it('returns model-invalid when catalog is reachable but model probe fails', async () => {
      fetchMock.mockResolvedValueOnce(errorResponse(404));
      fetchMock.mockResolvedValueOnce(modelsBody('public-model', 'selected-model'));
      expect(await validateApiKey('openai', 'sk-key', 'https://api.example.com/v1', 'missing-model')).toEqual({
        valid: false,
        reason: 'model-invalid',
        models: ['public-model', 'selected-model'],
      });
    });

    it('returns rejected when chat probe fails and catalog fails', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
      expect(await validateApiKey('openai', 'sk-key', 'https://api.example.com/v1', 'some-model')).toEqual({
        valid: false,
        reason: 'rejected',
      });
    });

    it('uses default openai models endpoint when base URL is the default', async () => {
      fetchMock.mockResolvedValueOnce(modelsBody('gpt-4o-mini'));
      expect(await validateApiKey('openai', 'sk-good', 'https://api.openai.com/v1')).toEqual({
        valid: true,
        models: ['gpt-4o-mini'],
      });
    });

    it('uses default openai models endpoint when base URL is empty', async () => {
      fetchMock.mockResolvedValueOnce(modelsBody('gpt-4o-mini'));
      expect(await validateApiKey('openai', 'sk-good', '')).toEqual({
        valid: true,
        models: ['gpt-4o-mini'],
      });
    });

    it('uses default openai models endpoint when base URL is undefined', async () => {
      fetchMock.mockResolvedValueOnce(modelsBody('gpt-4o-mini'));
      expect(await validateApiKey('openai', 'sk-good', undefined)).toEqual({
        valid: true,
        models: ['gpt-4o-mini'],
      });
    });
  });

  describe('a custom server on any provider', () => {
    it('probes an openai-protocol server at chat/completions with a bearer token', async () => {
      fetchMock.mockResolvedValueOnce(chatOkBody());
      fetchMock.mockResolvedValueOnce(modelsBody('mock-tiny'));
      await validateApiKey('openai', 'sk-key', 'http://localhost:8787/v1', 'mock-tiny');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://localhost:8787/v1/chat/completions');
      expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer sk-key');
    });

    it('probes an anthropic-protocol server at messages with an x-api-key', async () => {
      fetchMock.mockResolvedValueOnce(chatOkBody());
      fetchMock.mockResolvedValueOnce(modelsBody('claude-local'));
      expect(await validateApiKey('anthropic', 'ak-key', 'http://localhost:4000', 'claude-local')).toEqual({
        valid: true,
        models: ['claude-local'],
      });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://localhost:4000/messages');
      const headers = init!.headers as Record<string, string>;
      expect(headers['x-api-key']).toBe('ak-key');
      expect(headers.Authorization).toBeUndefined();
      expect(JSON.parse(init!.body as string).max_tokens).toBe(8);
    });

    it('lets deepseek point somewhere else', async () => {
      fetchMock.mockResolvedValueOnce(chatOkBody());
      fetchMock.mockResolvedValueOnce(modelsBody('local-r1'));
      expect(await validateApiKey('deepseek', 'sk-key', 'http://localhost:1234/v1', 'local-r1')).toEqual({
        valid: true,
        models: ['local-r1'],
      });
      expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:1234/v1/chat/completions');
    });

    it('treats a provider default typed in by hand as the default, not a custom server', async () => {
      fetchMock.mockResolvedValueOnce(modelsBody('deepseek-v4-flash'));
      expect(await validateApiKey('deepseek', 'sk-key', 'https://api.deepseek.com/', 'deepseek-v4-flash')).toEqual({
        valid: true,
        models: ['deepseek-v4-flash'],
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.deepseek.com/models');
    });

    it('checks an anthropic key against anthropic by default', async () => {
      fetchMock.mockResolvedValueOnce(modelsBody('claude-3-5-haiku-20241022'));
      await validateApiKey('anthropic', 'ak-key');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.anthropic.com/v1/models');
      expect((init!.headers as Record<string, string>)['anthropic-version']).toBe('2023-06-01');
    });

    it('no longer knows the removed compatible provider, and sends it no key', async () => {
      expect(await validateApiKey('openaiCompatible', 'sk-key', 'http://localhost:8787/v1', 'mock-tiny')).toEqual({
        valid: false,
        reason: 'network',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
