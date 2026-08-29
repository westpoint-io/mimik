import { describe, expect, it, vi } from 'vitest';

type ProviderOptions = { apiKey?: string; baseURL?: string };

const createOpenAI = vi.fn((_options: ProviderOptions) => vi.fn((m: string) => ({ kind: 'openai', model: m })));
const createAnthropic = vi.fn((_options: ProviderOptions) => vi.fn((m: string) => ({ kind: 'anthropic', model: m })));
const createAzure = vi.fn((_options: ProviderOptions) => vi.fn((m: string) => ({ kind: 'azure', model: m })));

vi.mock('@ai-sdk/openai', () => ({ createOpenAI: (o: ProviderOptions) => createOpenAI(o) }));
vi.mock('@ai-sdk/anthropic', () => ({ createAnthropic: (o: ProviderOptions) => createAnthropic(o) }));
vi.mock('@ai-sdk/azure', () => ({ createAzure: (o: ProviderOptions) => createAzure(o) }));

const { createModel, isConnectionConfigured } = await import('../provider');

describe('createModel', () => {
  it('still routes anthropic to the anthropic provider', () => {
    createModel({ provider: 'anthropic', model: 'claude-3-5-haiku-20241022', apiKey: 'ant' });
    expect(createAnthropic).toHaveBeenCalledWith({ apiKey: 'ant' });
  });

  it('still sends a bare openai config straight to openai with no base url', () => {
    createModel({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'sk' });
    expect(createOpenAI).toHaveBeenCalledWith({ apiKey: 'sk' });
  });

  it('routes azure through the azure provider, not the openai one', () => {
    createModel({
      provider: 'azure',
      model: 'my-deployment',
      apiKey: 'az',
      baseURL: 'https://my-res.openai.azure.com',
    });
    expect(createAzure).toHaveBeenCalled();
    const [opts] = createAzure.mock.calls.at(-1) as [ProviderOptions];
    expect(opts.apiKey).toBe('az');
    expect(opts.baseURL).toBe('https://my-res.openai.azure.com/openai');
  });

  it('treats the azure model id as a deployment name, passing it through untouched', () => {
    const model = createModel({
      provider: 'azure',
      model: 'my-deployment-mini',
      apiKey: 'az',
      baseURL: 'https://my-res.openai.azure.com',
    }) as unknown as { model: string };
    expect(model.model).toBe('my-deployment-mini');
  });
});

describe('createModel refuses to silently reach the cloud', () => {
  it('throws rather than falling back to OpenAI when azure has no endpoint', () => {
    expect(() => createModel({ provider: 'azure', model: 'my-deployment', apiKey: 'sk-real-key' })).toThrow();
    expect(() =>
      createModel({ provider: 'azure', model: 'my-deployment', apiKey: 'sk-real-key', baseURL: '' }),
    ).toThrow();
  });

  it('throws rather than dialling the cloud when the endpoint is unusable', () => {
    expect(() =>
      createModel({ provider: 'azure', model: 'my-deployment', apiKey: 'sk', baseURL: 'not-a-url' }),
    ).toThrow();
  });

  it('never falls through to a bare OpenAI client when azure is misconfigured', () => {
    createOpenAI.mockClear();
    try {
      createModel({ provider: 'azure', model: 'my-deployment', apiKey: 'sk-real-key', baseURL: '' });
    } catch {
      // expected
    }
    expect(createOpenAI).not.toHaveBeenCalled();
  });
});

describe('isConnectionConfigured', () => {
  it('accepts a plain openai setup with just a key', () => {
    expect(isConnectionConfigured({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'sk' })).toBe(true);
  });

  it('rejects a plain openai setup with no key', () => {
    expect(isConnectionConfigured({ provider: 'openai', model: 'gpt-4o-mini', apiKey: '' })).toBe(false);
  });

  it('rejects an azure setup with a key but no endpoint', () => {
    expect(isConnectionConfigured({ provider: 'azure', model: 'my-deployment', apiKey: 'az' })).toBe(false);
  });

  it('rejects an azure setup with an endpoint but no key, since azure always authenticates', () => {
    expect(
      isConnectionConfigured({
        provider: 'azure',
        model: 'my-deployment',
        apiKey: '',
        baseURL: 'https://r.openai.azure.com',
      }),
    ).toBe(false);
  });

  it('accepts a fully configured azure setup', () => {
    expect(
      isConnectionConfigured({
        provider: 'azure',
        model: 'my-deployment',
        apiKey: 'az',
        baseURL: 'https://r.openai.azure.com',
      }),
    ).toBe(true);
  });

  it('rejects an azure setup with an endpoint and key but no deployment name', () => {
    expect(
      isConnectionConfigured({
        provider: 'azure',
        model: '',
        apiKey: 'az',
        baseURL: 'https://r.openai.azure.com',
      }),
    ).toBe(false);
  });

  it('rejects an azure setup where the deployment name is whitespace only', () => {
    expect(
      isConnectionConfigured({
        provider: 'azure',
        model: '   ',
        apiKey: 'az',
        baseURL: 'https://r.openai.azure.com',
      }),
    ).toBe(false);
  });
});
