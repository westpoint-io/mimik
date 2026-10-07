import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchVoices, parseVoices, speechRequest, synthesizeSpeech } from '@/core/export/voiceover/client';
import type { VoiceoverConfig } from '@/core/export/voiceover/config';

const openai: VoiceoverConfig = {
  provider: 'openai',
  apiKey: 'sk-test',
  voiceId: 'alloy',
  modelId: 'gpt-4o-mini-tts',
  source: 'voiceover',
};

const eleven: VoiceoverConfig = {
  provider: 'elevenlabs',
  apiKey: 'sk_test',
  voiceId: '21m00Tcm4TlvDq8ikWAM',
  modelId: 'eleven_turbo_v2_5',
  source: 'voiceover',
};

afterEach(() => vi.unstubAllGlobals());

describe('speechRequest', () => {
  it('posts OpenAI the text as input, with the voice in the body', () => {
    const request = speechRequest(openai, 'Click Save');
    expect(request.url).toBe('https://api.openai.com/v1/audio/speech');
    expect(request.headers.Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(request.body)).toEqual({
      model: 'gpt-4o-mini-tts',
      voice: 'alloy',
      input: 'Click Save',
      response_format: 'mp3',
    });
  });

  it('puts the ElevenLabs voice in the path and the key in its own header', () => {
    const request = speechRequest(eleven, 'Click Save');
    expect(request.url).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM?output_format=mp3_44100_128',
    );
    expect(request.headers['xi-api-key']).toBe('sk_test');
    expect(request.headers.Authorization).toBeUndefined();
    expect(JSON.parse(request.body)).toEqual({ text: 'Click Save', model_id: 'eleven_turbo_v2_5' });
  });

  it('escapes a voice id rather than splicing it into the path raw', () => {
    expect(speechRequest({ ...eleven, voiceId: 'a/../b' }, 'x').url).toContain('a%2F..%2Fb');
  });
});

describe('synthesizeSpeech', () => {
  const respond = (init: { ok: boolean; status?: number; body?: string }) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: init.ok,
        status: init.status ?? 200,
        text: async () => init.body ?? '',
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );
  };

  it('returns the audio bytes on success', async () => {
    respond({ ok: true });
    expect((await synthesizeSpeech(openai, 'Click Save')).byteLength).toBe(8);
  });

  it('never repeats the response body for a rejected key, which can echo it back', async () => {
    respond({ ok: false, status: 401, body: '{"error":{"message":"Incorrect API key provided: sk-test123"}}' });

    await expect(synthesizeSpeech(openai, 'Click Save')).rejects.toThrow(/rejected the API key \(401\)/);
    await expect(synthesizeSpeech(openai, 'Click Save')).rejects.not.toThrow(/sk-test123/);
  });

  it('keeps the body for an error that explains something useful', async () => {
    respond({ ok: false, status: 422, body: 'voice_not_found' });
    await expect(synthesizeSpeech(eleven, 'Click Save')).rejects.toThrow(/ElevenLabs returned 422: voice_not_found/);
  });
});

describe('fetchVoices', () => {
  it('serves OpenAI the shipped list without a request', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect((await fetchVoices('openai', 'sk-test')).map((voice) => voice.id)).toContain('alloy');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('parseVoices', () => {
  it('keeps the entries that carry an id and drops the rest', () => {
    expect(
      parseVoices({
        voices: [{ voice_id: 'v1', name: 'Rachel' }, { voice_id: 'v2' }, { name: 'no id' }, null, 'nonsense'],
      }),
    ).toEqual([
      { id: 'v1', name: 'Rachel' },
      { id: 'v2', name: 'v2' },
    ]);
  });

  it('is empty for anything that is not a voice list', () => {
    expect(parseVoices(null)).toEqual([]);
    expect(parseVoices({ voices: 'nope' })).toEqual([]);
    expect(parseVoices({ detail: 'unauthorized' })).toEqual([]);
  });
});
