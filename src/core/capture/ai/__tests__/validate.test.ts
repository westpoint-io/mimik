import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateApiKey } from '../validate';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('validateApiKey', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('accepts a key the provider returns 200 for', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(null) });
    expect(await validateApiKey('openai', 'sk-good')).toEqual({ valid: true });
  });

  it('reports a 401 as rejected, not as a network problem', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    expect(await validateApiKey('openai', 'sk-bad')).toEqual({ valid: false, reason: 'rejected' });
  });

  it('reports a 403 as rejected', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    expect(await validateApiKey('anthropic', 'bad')).toEqual({ valid: false, reason: 'rejected' });
  });

  it('does not blame the key when the request never completes', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await validateApiKey('openai', 'sk-good')).toEqual({ valid: false, reason: 'network' });
  });

  it('does not blame the key on a provider outage', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    expect(await validateApiKey('openai', 'sk-good')).toEqual({ valid: false, reason: 'network' });
  });

  it('sends the anthropic browser-access header so the request is not blocked by CORS', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(null) });
    await validateApiKey('anthropic', 'ant-key');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/models');
    expect(init.headers['x-api-key']).toBe('ant-key');
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  it('sends a bearer token for openai', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(null) });
    await validateApiKey('openai', 'sk-key');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/models');
    expect(init.headers.Authorization).toBe('Bearer sk-key');
  });

  it('checks a groq key against groq, not openai', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(null) });
    expect(await validateApiKey('groq', 'gsk-key')).toEqual({ valid: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/models');
    expect(init.headers.Authorization).toBe('Bearer gsk-key');
  });

  it('gives up rather than spinning forever when a host never answers', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(null) });
    await validateApiKey('openai', 'sk-key');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('never sends a key to an unknown provider, and does not call it rejected', async () => {
    expect(await validateApiKey('mystery', 'secret')).toEqual({ valid: false, reason: 'network' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a compatible key when the chat probe returns 401', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.endsWith('/models') ? { ok: true, status: 200 } : { ok: false, status: 401 }),
    );
    expect(
      await validateApiKey('openaiCompatible', 'sk-key', 'https://api.example.com/v1', 'compatible-model'),
    ).toEqual({
      valid: false,
      reason: 'rejected',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/v1/chat/completions');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.example.com/v1/models');
  });

  it('strips trailing slashes from a compatible base URL', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(null) });
    await validateApiKey('openaiCompatible', 'sk-key', 'https://api.example.com/v1///', 'compatible-model');
    const [url] = fetchMock.mock.calls[1];
    expect(url).toBe('https://api.example.com/v1/models');
  });

  it('does not send a compatible key anywhere when no base URL is set', async () => {
    expect(await validateApiKey('openaiCompatible', 'sk-key', undefined, 'compatible-model')).toEqual({
      valid: false,
      reason: 'network',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not validate a compatible key when the model is empty', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [{ id: 'discovered-model' }] }),
    });
    expect(await validateApiKey('openaiCompatible', 'sk-key', 'https://api.example.com/v1', '  ')).toEqual({
      valid: false,
      reason: 'model-required',
      models: ['discovered-model'],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/v1/models');
  });

  it('keeps a compatible key rejected when the catalog includes the selected model', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/chat/completions')
          ? { ok: false, status: 401 }
          : { ok: true, status: 200, json: () => Promise.resolve({ data: [{ id: 'public-model' }] }) },
      ),
    );
    expect(await validateApiKey('openaiCompatible', 'sk-key', 'https://api.example.com/v1', 'public-model')).toEqual({
      valid: false,
      reason: 'rejected',
      models: ['public-model'],
    });
  });

  it('classifies a rejected inference for a model absent from a successful catalog as model-invalid', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/chat/completions')
          ? { ok: false, status: 401 }
          : { ok: true, status: 200, json: () => Promise.resolve({ data: [{ id: 'available-model' }] }) },
      ),
    );
    expect(
      await validateApiKey('openaiCompatible', 'sk-key', 'https://api.example.com/v1', '  missing-model  '),
    ).toEqual({
      valid: false,
      reason: 'model-invalid',
      models: ['available-model'],
    });
  });

  it('classifies a network inference failure for a model absent from a successful catalog as model-invalid', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/chat/completions')
          ? { ok: false, status: 500 }
          : { ok: true, status: 200, json: () => Promise.resolve({ data: [{ id: 'available-model' }] }) },
      ),
    );
    expect(await validateApiKey('openaiCompatible', 'sk-key', 'https://api.example.com/v1', 'missing-model')).toEqual({
      valid: false,
      reason: 'model-invalid',
      models: ['available-model'],
    });
  });

  it('probes a compatible key with the selected model, then returns catalog models', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url.endsWith('/chat/completions')
          ? { ok: true, status: 200 }
          : { ok: true, status: 200, json: () => Promise.resolve({ data: [{ id: 'model-a' }, { id: 'model-b' }] }) },
      ),
    );
    expect(await validateApiKey('openaiCompatible', 'sk-key', 'https://api.example.com/v1', 'selected-model')).toEqual({
      valid: true,
      models: ['model-a', 'model-b'],
    });
    const [probeUrl, probeInit] = fetchMock.mock.calls[0];
    expect(probeUrl).toBe('https://api.example.com/v1/chat/completions');
    expect(probeInit.method).toBe('POST');
    expect(JSON.parse(probeInit.body)).toMatchObject({ model: 'selected-model', max_tokens: 8, stream: false });
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.example.com/v1/models');
  });

  it('keeps a compatible key valid when the catalog request fails', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.endsWith('/chat/completions') ? { ok: true, status: 200 } : { ok: false, status: 500 }),
    );
    expect(await validateApiKey('openaiCompatible', 'sk-key', 'https://api.example.com/v1', 'selected-model')).toEqual({
      valid: true,
    });
  });

  it('returns the model ids a provider lists for the key', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [{ id: 'gpt-4o-mini' }, { id: 'gpt-4o' }] }),
    });
    expect(await validateApiKey('openai', 'sk-key')).toEqual({
      valid: true,
      models: ['gpt-4o-mini', 'gpt-4o'],
    });
  });

  it('stays valid when a key works but no models come back', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    });
    expect(await validateApiKey('openai', 'sk-key')).toEqual({ valid: true });
  });

  it('stays valid when the body is not a model list at all', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('not json')),
    });
    expect(await validateApiKey('openai', 'sk-key')).toEqual({ valid: true });
  });

  it('drops blank entries from a malformed model list', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [{ id: '' }, { id: 'ok-model' }, {}, 'junk'] }),
    });
    expect(await validateApiKey('groq', 'gsk-key')).toEqual({ valid: true, models: ['ok-model'] });
  });
});
