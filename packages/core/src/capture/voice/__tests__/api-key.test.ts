import { describe, expect, it } from 'vitest';
import { hasVoiceApiKey, normalizeVoiceProvider, resolveVoiceApiKey, VOICE_KEY_SETTINGS } from '../api-key';

describe('resolveVoiceApiKey', () => {
  it('uses the voice key when the provider is openai and one is set', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', voiceApiKey: 'sk-voice' })).toEqual({
      provider: 'openai',
      apiKey: 'sk-voice',
    });
  });

  it('falls back to the ai key when the provider is openai and the voice key is empty', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', voiceApiKey: '', aiApiKey: 'sk-ai' })).toEqual({
      provider: 'openai',
      apiKey: 'sk-ai',
    });
  });

  it('falls back when the voice key is missing entirely', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', aiApiKey: 'sk-ai' })).toEqual({
      provider: 'openai',
      apiKey: 'sk-ai',
    });
  });

  it('resolves nothing when the provider is openai and both keys are empty', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', voiceApiKey: '', aiApiKey: '' })).toEqual({
      provider: 'openai',
      apiKey: '',
    });
  });

  it('never lends an openai key to groq', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'groq', voiceApiKey: '', aiApiKey: 'sk-ai' })).toEqual({
      provider: 'groq',
      apiKey: '',
    });
  });

  it('keeps a groq key of its own', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'groq', voiceApiKey: 'gsk-voice', aiApiKey: 'sk-ai' })).toEqual({
      provider: 'groq',
      apiKey: 'gsk-voice',
    });
  });

  it('does not lend an anthropic key to a whisper endpoint', () => {
    expect(
      resolveVoiceApiKey({ voiceProvider: 'openai', voiceApiKey: '', aiProvider: 'anthropic', aiApiKey: 'sk-ant-x' }),
    ).toEqual({ provider: 'openai', apiKey: '' });
  });

  it('treats a missing ai provider as openai', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', aiProvider: undefined, aiApiKey: 'sk-ai' }).apiKey).toBe(
      'sk-ai',
    );
  });

  it('treats a whitespace-only voice key as empty', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', voiceApiKey: '   \n\t ', aiApiKey: 'sk-ai' })).toEqual({
      provider: 'openai',
      apiKey: 'sk-ai',
    });
  });

  it('treats a whitespace-only ai key as empty', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', voiceApiKey: '', aiApiKey: '   ' })).toEqual({
      provider: 'openai',
      apiKey: '',
    });
  });

  it('trims the key it hands back', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', voiceApiKey: '  sk-voice  ' }).apiKey).toBe('sk-voice');
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', aiApiKey: '  sk-ai  ' }).apiKey).toBe('sk-ai');
  });

  it('ignores non-string stored values', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', voiceApiKey: 42, aiApiKey: { key: 'sk-ai' } })).toEqual({
      provider: 'openai',
      apiKey: '',
    });
  });

  it('falls back to openai for an unknown or missing provider', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'deepgram', aiApiKey: 'sk-ai' })).toEqual({
      provider: 'openai',
      apiKey: 'sk-ai',
    });
    expect(resolveVoiceApiKey({}).provider).toBe('openai');
  });

  it('resolves nothing from empty storage', () => {
    expect(resolveVoiceApiKey({})).toEqual({ provider: 'openai', apiKey: '' });
  });
});

describe('hasVoiceApiKey', () => {
  it('is true when a key resolves and false when none does', () => {
    expect(hasVoiceApiKey({ voiceProvider: 'openai', aiApiKey: 'sk-ai' })).toBe(true);
    expect(hasVoiceApiKey({ voiceProvider: 'groq', aiApiKey: 'sk-ai' })).toBe(false);
    expect(hasVoiceApiKey({})).toBe(false);
  });
});

describe('normalizeVoiceProvider', () => {
  it('accepts groq and server and defaults everything else to openai', () => {
    expect(normalizeVoiceProvider('groq')).toBe('groq');
    expect(normalizeVoiceProvider('server')).toBe('server');
    expect(normalizeVoiceProvider('openai')).toBe('openai');
    expect(normalizeVoiceProvider('whisper.cpp')).toBe('openai');
    expect(normalizeVoiceProvider(undefined)).toBe('openai');
  });
});

describe('resolveVoiceApiKey with a custom AI server', () => {
  it('does not borrow a key meant for another server', () => {
    expect(
      resolveVoiceApiKey({ voiceProvider: 'openai', aiApiKey: 'sk-proxy', aiBaseUrl: 'https://llm.corp.example/v1' }),
    ).toMatchObject({ apiKey: '' });
  });

  it('still borrows when the base URL is the default one', () => {
    expect(
      resolveVoiceApiKey({ voiceProvider: 'openai', aiApiKey: 'sk-ai', aiBaseUrl: 'https://api.openai.com/v1' }),
    ).toMatchObject({ apiKey: 'sk-ai' });
  });
});

describe('resolveVoiceApiKey with the voice provider set to server', () => {
  const server = { voiceProvider: 'server', aiServerUrl: 'http://localhost:8000/v1', apiKeys: { server: 'sk-local' } };

  it('uses the server address and key', () => {
    expect(resolveVoiceApiKey(server)).toEqual({
      provider: 'server',
      apiKey: 'sk-local',
      baseUrl: 'http://localhost:8000/v1',
    });
  });

  it('carries the server custom headers', () => {
    const headers = [
      { name: 'X-Team', value: ' docs ' },
      { name: 'bad name', value: 'dropped' },
    ];
    expect(resolveVoiceApiKey({ ...server, aiServerHeaders: headers })).toMatchObject({
      headers: { 'X-Team': 'docs' },
    });
  });

  it('is usable without a key', () => {
    expect(hasVoiceApiKey({ ...server, apiKeys: {} })).toBe(true);
  });

  it('is unusable without an address', () => {
    expect(hasVoiceApiKey({ voiceProvider: 'server', apiKeys: { server: 'sk-local' } })).toBe(false);
  });

  it('is unusable when the server speaks the Anthropic protocol', () => {
    expect(resolveVoiceApiKey({ ...server, aiServerProtocol: 'anthropic' })).toEqual({
      provider: 'server',
      apiKey: '',
    });
    expect(hasVoiceApiKey({ ...server, aiServerProtocol: 'anthropic' })).toBe(false);
  });
});

describe('VOICE_KEY_SETTINGS', () => {
  it('names every storage key the resolution reads', () => {
    expect([...VOICE_KEY_SETTINGS]).toEqual(
      expect.arrayContaining([
        'apiKeys',
        'voiceProvider',
        'voiceApiKey',
        'aiApiKey',
        'aiApiKeys',
        'aiBaseUrl',
        'aiServerUrl',
        'aiServerProtocol',
      ]),
    );
  });
});
