import { describe, expect, it } from 'vitest';
import {
  aiChoice,
  migrateApiKeys,
  parseApiKeys,
  readApiKeys,
  resolveAiCredentials,
  resolveServer,
  withKey,
} from '../keys';

describe('parseApiKeys', () => {
  it('keeps only keys for providers that exist', () => {
    expect(parseApiKeys({ openai: 'sk-a', openaiCompatible: 'sk-gone', anthropic: 'ak-b' })).toEqual({
      openai: 'sk-a',
      anthropic: 'ak-b',
    });
  });

  it('drops blank keys and non-strings', () => {
    expect(parseApiKeys({ openai: '   ', anthropic: 42, deepseek: 'sk-c' })).toEqual({ deepseek: 'sk-c' });
  });

  it('reads anything that is not an object as no keys', () => {
    expect(parseApiKeys(null)).toEqual({});
    expect(parseApiKeys('sk-loose')).toEqual({});
    expect(parseApiKeys(undefined)).toEqual({});
  });
});

describe('migrateApiKeys', () => {
  it('attaches a pre-existing single key to the provider that was selected', () => {
    expect(migrateApiKeys({ aiApiKey: 'sk-legacy', aiProvider: 'anthropic' })).toEqual({ anthropic: 'sk-legacy' });
  });

  it('attaches a legacy key to openai when the stored provider is gone', () => {
    expect(migrateApiKeys({ aiApiKey: 'sk-legacy', aiProvider: 'openaiCompatible' })).toEqual({ openai: 'sk-legacy' });
  });

  it('prefers the per-provider map once it exists', () => {
    expect(migrateApiKeys({ aiApiKeys: { openai: 'sk-new' }, aiApiKey: 'sk-legacy', aiProvider: 'anthropic' })).toEqual(
      { openai: 'sk-new' },
    );
  });

  it('returns nothing when no key was ever saved', () => {
    expect(migrateApiKeys({})).toEqual({});
    expect(migrateApiKeys({ aiApiKey: '  ' })).toEqual({});
  });
});

describe('readApiKeys', () => {
  it('gathers the keys each feature used to keep on its own', () => {
    expect(
      readApiKeys({
        aiApiKeys: { anthropic: 'ak-ai' },
        voiceProvider: 'groq',
        voiceApiKey: 'gsk-voice',
        voiceoverApiKeys: { elevenlabs: 'sk_eleven' },
      }),
    ).toEqual({ anthropic: 'ak-ai', groq: 'gsk-voice', elevenlabs: 'sk_eleven' });
  });

  it('keeps the descriptions key when two features held different OpenAI keys', () => {
    expect(
      readApiKeys({ aiApiKeys: { openai: 'sk-ai' }, voiceApiKey: 'sk-voice', voiceoverApiKeys: { openai: 'sk-vo' } }),
    ).toEqual({ openai: 'sk-ai' });
  });

  it('ignores the old settings once the single map exists, even an empty one', () => {
    expect(readApiKeys({ apiKeys: {}, aiApiKeys: { openai: 'sk-old' }, voiceApiKey: 'sk-voice' })).toEqual({});
    expect(readApiKeys({ apiKeys: { groq: ' gsk-a ', bogus: 'x' } })).toEqual({ groq: 'gsk-a' });
  });
});

describe('withKey', () => {
  it('stores a key against one provider without touching the others', () => {
    expect(withKey({ openai: 'sk-a' }, 'elevenlabs', 'sk_b')).toEqual({ openai: 'sk-a', elevenlabs: 'sk_b' });
  });

  it('clearing one provider leaves the others intact', () => {
    expect(withKey({ openai: 'sk-a', groq: 'gsk-b' }, 'groq', '   ')).toEqual({ openai: 'sk-a' });
  });
});

describe('resolveAiCredentials', () => {
  it('hands back the key belonging to the selected provider, never another', () => {
    const stored = { apiKeys: { openai: 'sk-openai', anthropic: 'ak-anthropic' }, aiProvider: 'anthropic' };
    expect(resolveAiCredentials(stored)).toMatchObject({ provider: 'anthropic', apiKey: 'ak-anthropic' });
  });

  it('reports nothing rather than a neighbour key when the selected provider has none', () => {
    expect(resolveAiCredentials({ apiKeys: { openai: 'sk-openai' }, aiProvider: 'openrouter' })).toBeNull();
  });

  it('falls back to openai for an unknown stored provider', () => {
    expect(resolveAiCredentials({ apiKeys: { openai: 'sk-a' }, aiProvider: 'nope' })).toMatchObject({
      provider: 'openai',
      apiKey: 'sk-a',
    });
  });

  it('uses your own server without a key, since a local one needs none', () => {
    expect(
      resolveAiCredentials({ aiProvider: 'server', aiServerUrl: 'http://localhost:11434/v1', aiModel: 'llama3.2' }),
    ).toEqual({ provider: 'openai', apiKey: '', model: 'llama3.2', baseUrl: 'http://localhost:11434/v1' });
  });

  it('talks to an Anthropic-compatible server with the Anthropic client', () => {
    expect(
      resolveAiCredentials({
        aiProvider: 'server',
        aiServerUrl: 'http://proxy:4000',
        aiServerProtocol: 'anthropic',
        aiModel: 'claude',
        apiKeys: { server: 'sk-proxy' },
      }),
    ).toMatchObject({ provider: 'anthropic', apiKey: 'sk-proxy' });
  });

  it('needs a model for your own server, because it has no default to fall back on', () => {
    expect(resolveAiCredentials({ aiProvider: 'server', aiServerUrl: 'http://localhost:11434/v1' })).toBeNull();
  });
});

describe('an own server saved before API keys had a section', () => {
  const legacy = {
    aiProvider: 'openai',
    aiBaseUrl: 'http://localhost:11434/v1',
    aiModel: 'llama3.2',
    aiApiKeys: { openai: 'ollama' },
  };

  it('still counts as your own server, with the key it was saved with', () => {
    expect(aiChoice(legacy)).toBe('server');
    expect(resolveServer(legacy)).toEqual({ url: 'http://localhost:11434/v1', protocol: 'openai', apiKey: 'ollama' });
  });

  it('is not mistaken for one once the address has moved to its own setting', () => {
    expect(aiChoice({ ...legacy, aiProvider: 'anthropic', aiBaseUrl: '' })).toBe('anthropic');
  });
});
