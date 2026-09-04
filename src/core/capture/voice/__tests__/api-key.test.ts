import { describe, expect, it } from 'vitest';
import { hasVoiceApiKey, normalizeVoiceProvider, resolveVoiceApiKey, VOICE_KEY_SETTINGS } from '../api-key';

describe('resolveVoiceApiKey', () => {
  it('uses the voice key when the provider is openai and one is set', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', voiceApiKey: 'sk-voice', aiApiKey: 'sk-ai' })).toEqual({
      provider: 'openai',
      apiKey: 'sk-voice',
      source: 'voice',
    });
  });

  it('falls back to the ai key when the provider is openai and the voice key is empty', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', voiceApiKey: '', aiApiKey: 'sk-ai' })).toEqual({
      provider: 'openai',
      apiKey: 'sk-ai',
      source: 'ai',
    });
  });

  it('falls back when the voice key is missing entirely', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', aiApiKey: 'sk-ai' })).toEqual({
      provider: 'openai',
      apiKey: 'sk-ai',
      source: 'ai',
    });
  });

  it('resolves nothing when the provider is openai and both keys are empty', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', voiceApiKey: '', aiApiKey: '' })).toEqual({
      provider: 'openai',
      apiKey: '',
      source: 'none',
    });
  });

  it('never lends an openai key to groq', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'groq', voiceApiKey: '', aiApiKey: 'sk-ai' })).toEqual({
      provider: 'groq',
      apiKey: '',
      source: 'none',
    });
  });

  it('keeps a groq key of its own', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'groq', voiceApiKey: 'gsk-voice', aiApiKey: 'sk-ai' })).toEqual({
      provider: 'groq',
      apiKey: 'gsk-voice',
      source: 'voice',
    });
  });

  it('does not lend an anthropic key to a whisper endpoint', () => {
    expect(
      resolveVoiceApiKey({ voiceProvider: 'openai', voiceApiKey: '', aiProvider: 'anthropic', aiApiKey: 'sk-ant-x' }),
    ).toEqual({ provider: 'openai', apiKey: '', source: 'none' });
  });

  it('does not lend an openrouter key to a whisper endpoint', () => {
    expect(
      resolveVoiceApiKey({ voiceProvider: 'openai', voiceApiKey: '', aiProvider: 'openrouter', aiApiKey: 'sk-or-x' }),
    ).toEqual({ provider: 'openai', apiKey: '', source: 'none' });
  });

  it('treats a missing ai provider as openai', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', aiProvider: undefined, aiApiKey: 'sk-ai' }).source).toBe('ai');
  });

  it('treats a whitespace-only voice key as empty', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', voiceApiKey: '   \n\t ', aiApiKey: 'sk-ai' })).toEqual({
      provider: 'openai',
      apiKey: 'sk-ai',
      source: 'ai',
    });
  });

  it('treats a whitespace-only ai key as empty', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'openai', voiceApiKey: '', aiApiKey: '   ' })).toEqual({
      provider: 'openai',
      apiKey: '',
      source: 'none',
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
      source: 'none',
    });
  });

  it('falls back to openai for an unknown or missing provider', () => {
    expect(resolveVoiceApiKey({ voiceProvider: 'deepgram', aiApiKey: 'sk-ai' })).toEqual({
      provider: 'openai',
      apiKey: 'sk-ai',
      source: 'ai',
    });
    expect(resolveVoiceApiKey({}).provider).toBe('openai');
  });

  it('resolves nothing from empty storage', () => {
    expect(resolveVoiceApiKey({})).toEqual({ provider: 'openai', apiKey: '', source: 'none' });
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
  it('accepts groq and defaults everything else to openai', () => {
    expect(normalizeVoiceProvider('groq')).toBe('groq');
    expect(normalizeVoiceProvider('openai')).toBe('openai');
    expect(normalizeVoiceProvider('whisper.cpp')).toBe('openai');
    expect(normalizeVoiceProvider(undefined)).toBe('openai');
  });
});

describe('VOICE_KEY_SETTINGS', () => {
  it('names every storage key the resolution reads', () => {
    expect([...VOICE_KEY_SETTINGS]).toEqual(['voiceProvider', 'voiceApiKey', 'aiProvider', 'aiApiKey']);
  });
});
