import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranscriber, type TranscribeConfig } from '../transcribe';

const wav = new Blob([new Uint8Array(44)], { type: 'audio/wav' });

const scored = { no_speech_prob: 0.01, avg_logprob: -0.2, compression_ratio: 1.4 };
const verbose = {
  text: 'Open the settings menu.',
  segments: [{ start: 0, end: 2, text: 'Open the settings menu.', ...scored }],
  words: [{ word: 'Open', start: 0, end: 0.4 }],
};

let fetchMock: ReturnType<typeof vi.fn>;

const respondWith = (body: unknown, status = 200) => {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  fetchMock.mockImplementation(async () => new Response(payload, { status }));
};

const sentTo = (call = 0) => fetchMock.mock.calls[call][0] as string;
const sentInit = (call = 0) => fetchMock.mock.calls[call][1] as RequestInit;
const sentForm = (call = 0) => sentInit(call).body as FormData;

const run = (config: TranscribeConfig) => createTranscriber(config)(wav);

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  respondWith(verbose);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createTranscriber', () => {
  it('appends timestamp_granularities[] twice, as word and segment', async () => {
    await run({ provider: 'openai', apiKey: 'sk-test' });
    expect(sentForm().getAll('timestamp_granularities[]')).toEqual(['word', 'segment']);
  });

  it('requests verbose_json at temperature 0', async () => {
    await run({ provider: 'openai', apiKey: 'sk-test' });
    expect(sentForm().get('response_format')).toBe('verbose_json');
    expect(sentForm().get('temperature')).toBe('0');
  });

  it('sends the audio file part', async () => {
    await run({ provider: 'openai', apiKey: 'sk-test' });
    expect(sentForm().get('file')).toBeInstanceOf(Blob);
  });

  it('sends whisper-1 to the OpenAI endpoint', async () => {
    await run({ provider: 'openai', apiKey: 'sk-test' });
    expect(sentTo()).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(sentForm().get('model')).toBe('whisper-1');
  });

  it('sends whisper-large-v3 to the Groq endpoint', async () => {
    await run({ provider: 'groq', apiKey: 'gsk-test' });
    expect(sentTo()).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    expect(sentForm().get('model')).toBe('whisper-large-v3');
  });

  it('authorises with a bearer token', async () => {
    await run({ provider: 'openai', apiKey: 'sk-test' });
    expect(sentInit().method).toBe('POST');
    expect(sentInit().headers).toEqual({ Authorization: 'Bearer sk-test' });
  });

  it('never sends a prompt parameter under any config', async () => {
    const configs: TranscribeConfig[] = [
      { provider: 'openai', apiKey: 'sk-test' },
      { provider: 'openai', apiKey: 'sk-test', language: 'en' },
      { provider: 'groq', apiKey: 'gsk-test' },
      { provider: 'groq', apiKey: 'gsk-test', language: 'pt' },
    ];
    for (const config of configs) await run(config);
    for (let call = 0; call < configs.length; call += 1) {
      expect(sentForm(call).has('prompt')).toBe(false);
    }
  });

  it('sends exactly the expected parameters and nothing else', async () => {
    await run({ provider: 'openai', apiKey: 'sk-test' });
    expect([...sentForm().keys()].sort()).toEqual([
      'file',
      'model',
      'response_format',
      'temperature',
      'timestamp_granularities[]',
      'timestamp_granularities[]',
    ]);
  });

  it('sends language when configured', async () => {
    await run({ provider: 'openai', apiKey: 'sk-test', language: 'pt' });
    expect(sentForm().get('language')).toBe('pt');
  });

  it('omits language when not configured', async () => {
    await run({ provider: 'openai', apiKey: 'sk-test' });
    expect(sentForm().has('language')).toBe(false);
  });

  it('throws with the status on a 401', async () => {
    respondWith('{"error":{"message":"Incorrect API key provided"}}', 401);
    await expect(run({ provider: 'openai', apiKey: 'sk-secret-key' })).rejects.toThrow(/401/);
  });

  it('throws with the status on a 429', async () => {
    respondWith('{"error":{"message":"Rate limit reached"}}', 429);
    await expect(run({ provider: 'groq', apiKey: 'gsk-test' })).rejects.toThrow(/429/);
  });

  it('never leaks the api key in the thrown error', async () => {
    respondWith('{"error":{"message":"Incorrect API key provided"}}', 401);
    await expect(run({ provider: 'openai', apiKey: 'sk-secret-key' })).rejects.toThrow(
      expect.not.stringContaining('sk-secret-key'),
    );
  });

  it('includes a truncated response body in the error', async () => {
    respondWith('x'.repeat(5000), 500);
    const error = await run({ provider: 'openai', apiKey: 'sk-test' }).catch((e: Error) => e);
    expect((error as Error).message.length).toBeLessThan(400);
  });

  it('throws when a successful response carries no segments', async () => {
    respondWith({ text: 'Open the settings menu.' });
    await expect(run({ provider: 'openai', apiKey: 'sk-test' })).rejects.toThrow(/segments/);
  });

  it('returns a well-formed verbose_json response as-is', async () => {
    await expect(run({ provider: 'openai', apiKey: 'sk-test' })).resolves.toEqual(verbose);
  });
});

describe('createTranscriber against an azure deployment', () => {
  const azure = {
    provider: 'azure' as const,
    apiKey: 'az-key',
    baseURL: 'https://my-res.openai.azure.com',
    model: 'whisper',
  };

  it('posts to the deployment route, which is how azure addresses a model', async () => {
    await run(azure);
    expect(sentTo()).toBe(
      'https://my-res.openai.azure.com/openai/deployments/whisper/audio/transcriptions?api-version=2024-06-01',
    );
  });

  it('appends the /openai path the user does not have to type', async () => {
    await run({ ...azure, baseURL: 'https://my-res.openai.azure.com/' });
    expect(sentTo()).toContain('/openai/deployments/whisper/');
  });

  it('authenticates with api-key, since azure rejects a bearer token', async () => {
    await run(azure);
    const headers = sentInit().headers as Record<string, string>;
    expect(headers['api-key']).toBe('az-key');
    expect(headers.Authorization).toBeUndefined();
  });

  it('sends the deployment name as the model, which azure accepts', async () => {
    await run(azure);
    expect(sentForm().get('model')).toBe('whisper');
  });

  it('still asks for the verbose payload the narration matcher depends on', async () => {
    await run(azure);
    expect(sentForm().get('response_format')).toBe('verbose_json');
    expect(sentForm().getAll('timestamp_granularities[]')).toEqual(['word', 'segment']);
  });

  it('refuses to transcribe rather than call the wrong host when no endpoint is set', async () => {
    await expect(run({ ...azure, baseURL: '' })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses to transcribe when no deployment name is given', async () => {
    await expect(run({ ...azure, model: '' })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves openai and groq on their own hosts with bearer auth', async () => {
    await run({ provider: 'openai', apiKey: 'sk-test' });
    expect(sentTo()).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect((sentInit().headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
  });
});
