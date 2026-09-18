import { describe, expect, it } from 'vitest';
import {
  hasVoiceoverKey,
  parseVoiceoverKeys,
  resolveVoiceoverConfig,
  withVoiceoverKey,
} from '@/core/export/voiceover/config';
import { VOICEOVER_PROVIDERS } from '@/core/export/voiceover/providers';

describe('resolveVoiceoverConfig', () => {
  it('defaults to OpenAI, the key most users already hold', () => {
    expect(resolveVoiceoverConfig({}).provider).toBe('openai');
  });

  it('prefers a voice-over key of its own over the AI key', () => {
    const config = resolveVoiceoverConfig({
      voiceoverApiKeys: { openai: 'sk-own' },
      aiProvider: 'openai',
      aiApiKeys: { openai: 'sk-ai' },
    });
    expect(config).toMatchObject({ apiKey: 'sk-own', source: 'voiceover' });
  });

  it('borrows the OpenAI key already set for descriptions', () => {
    const config = resolveVoiceoverConfig({ aiProvider: 'openai', aiApiKeys: { openai: 'sk-ai' } });
    expect(config).toMatchObject({ apiKey: 'sk-ai', source: 'ai' });
  });

  it('never borrows across vendors', () => {
    expect(
      resolveVoiceoverConfig({
        voiceoverProvider: 'elevenlabs',
        aiProvider: 'openai',
        aiApiKeys: { openai: 'sk-ai' },
      }),
    ).toMatchObject({ apiKey: '', source: 'none' });

    expect(resolveVoiceoverConfig({ aiProvider: 'anthropic', aiApiKeys: { anthropic: 'sk-ant' } })).toMatchObject({
      apiKey: '',
      source: 'none',
    });
  });

  it('drops a voice id belonging to the other provider rather than sending it', () => {
    expect(
      resolveVoiceoverConfig({ voiceoverProvider: 'openai', voiceoverVoiceId: '21m00Tcm4TlvDq8ikWAM' }).voiceId,
    ).toBe(VOICEOVER_PROVIDERS.openai.defaultVoice);
  });

  it('keeps an ElevenLabs id it cannot verify, because the account catalog is larger than ours', () => {
    expect(
      resolveVoiceoverConfig({ voiceoverProvider: 'elevenlabs', voiceoverVoiceId: 'cloned-voice-42' }).voiceId,
    ).toBe('cloned-voice-42');
  });

  it('falls back to the provider default for a model it does not offer', () => {
    expect(resolveVoiceoverConfig({ voiceoverProvider: 'openai', voiceoverModelId: 'eleven_turbo_v2_5' }).modelId).toBe(
      VOICEOVER_PROVIDERS.openai.defaultModel,
    );
  });
});

describe('voice-over key storage', () => {
  it('keeps each provider key, so switching back does not lose one', () => {
    const keys = withVoiceoverKey({ openai: 'sk-a' }, 'elevenlabs', 'sk_b');
    expect(keys).toEqual({ openai: 'sk-a', elevenlabs: 'sk_b' });
  });

  it('clears a key when the field is emptied', () => {
    expect(withVoiceoverKey({ openai: 'sk-a' }, 'openai', '  ')).toEqual({});
  });

  it('ignores junk and unknown providers in storage', () => {
    expect(parseVoiceoverKeys({ openai: 'sk-a', bogus: 'x', elevenlabs: 42 })).toEqual({ openai: 'sk-a' });
    expect(parseVoiceoverKeys(null)).toEqual({});
  });

  it('reports no key when nothing is set anywhere', () => {
    expect(hasVoiceoverKey({})).toBe(false);
    expect(hasVoiceoverKey({ voiceoverApiKeys: { openai: 'sk-a' } })).toBe(true);
  });
});
