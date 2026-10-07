import { describe, expect, it } from 'vitest';
import { hasVoiceoverKey, resolveVoiceoverConfig } from '@/core/export/voiceover/config';
import { VOICEOVER_PROVIDERS } from '@/core/export/voiceover/providers';

describe('resolveVoiceoverConfig', () => {
  it('defaults to OpenAI, the key most users already hold', () => {
    expect(resolveVoiceoverConfig({}).provider).toBe('openai');
  });

  it('uses the key saved for its provider', () => {
    expect(resolveVoiceoverConfig({ voiceoverProvider: 'elevenlabs', apiKeys: { elevenlabs: 'sk_e' } }).apiKey).toBe(
      'sk_e',
    );
  });

  it('shares the OpenAI key saved for descriptions', () => {
    const config = resolveVoiceoverConfig({ aiProvider: 'openai', aiApiKeys: { openai: 'sk-ai' } });
    expect(config.apiKey).toBe('sk-ai');
  });

  it('does not borrow a key meant for a custom AI server', () => {
    const config = resolveVoiceoverConfig({
      aiProvider: 'openai',
      aiApiKeys: { openai: 'sk-proxy' },
      aiBaseUrl: 'https://llm.corp.example/v1',
    });
    expect(config).toMatchObject({ apiKey: '' });
  });

  it('never borrows across vendors', () => {
    expect(
      resolveVoiceoverConfig({
        voiceoverProvider: 'elevenlabs',
        aiProvider: 'openai',
        aiApiKeys: { openai: 'sk-ai' },
      }),
    ).toMatchObject({ apiKey: '' });

    expect(resolveVoiceoverConfig({ aiProvider: 'anthropic', aiApiKeys: { anthropic: 'sk-ant' } })).toMatchObject({
      apiKey: '',
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

describe('hasVoiceoverKey', () => {
  it('reports no key when nothing is set anywhere', () => {
    expect(hasVoiceoverKey({})).toBe(false);
    expect(hasVoiceoverKey({ voiceoverApiKeys: { openai: 'sk-a' } })).toBe(true);
  });
});
