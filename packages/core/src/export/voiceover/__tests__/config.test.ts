import { describe, expect, it } from 'vitest';
import { canVoiceover, hasVoiceoverKey, resolveVoiceoverConfig } from '@/core/export/voiceover/config';
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

describe('resolveVoiceoverConfig with the provider set to server', () => {
  const server = {
    voiceoverProvider: 'server',
    aiServerUrl: 'http://localhost:8880/v1',
    apiKeys: { server: 'sk-local', openai: 'sk-openai' },
  };

  it('uses the server address and its key, never a hosted key', () => {
    expect(resolveVoiceoverConfig(server)).toMatchObject({
      provider: 'server',
      apiKey: 'sk-local',
      baseUrl: 'http://localhost:8880/v1',
    });
  });

  it('keeps any voice and model typed in', () => {
    expect(
      resolveVoiceoverConfig({ ...server, voiceoverVoiceId: ' af_bella ', voiceoverModelId: 'kokoro' }),
    ).toMatchObject({ voiceId: 'af_bella', modelId: 'kokoro' });
  });

  it('falls back to alloy and tts-1 when nothing is typed', () => {
    expect(resolveVoiceoverConfig(server)).toMatchObject({ voiceId: 'alloy', modelId: 'tts-1' });
  });

  it('is usable without a key', () => {
    expect(hasVoiceoverKey({ ...server, apiKeys: {} })).toBe(true);
  });

  it('is unusable without an address', () => {
    expect(hasVoiceoverKey({ voiceoverProvider: 'server', apiKeys: { server: 'sk-local' } })).toBe(false);
  });

  it('is unusable when the server speaks the Anthropic protocol', () => {
    const config = resolveVoiceoverConfig({ ...server, aiServerProtocol: 'anthropic' });
    expect(config).toMatchObject({ apiKey: '' });
    expect(config.baseUrl).toBeUndefined();
    expect(canVoiceover(config)).toBe(false);
  });
});
