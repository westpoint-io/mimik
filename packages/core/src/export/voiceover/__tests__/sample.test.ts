import { beforeEach, describe, expect, it, vi } from 'vitest';

const synthesizeSpeech = vi.fn();
const decodeClip = vi.fn();

vi.mock('../client', () => ({ synthesizeSpeech: (...args: unknown[]) => synthesizeSpeech(...args) }));
vi.mock('../audio', () => ({ decodeClip: (...args: unknown[]) => decodeClip(...args) }));

import type { VoiceoverConfig } from '../config';
import { sampleVoiceover } from '../sample';
import { SpeechError } from '../speech-error';

const CONFIG: VoiceoverConfig = {
  provider: 'server',
  apiKey: '',
  voiceId: 'af_bella',
  modelId: 'kokoro',
  baseUrl: 'http://localhost:8880/v1',
};
const BUFFER = { length: 10 } as AudioBuffer;

beforeEach(() => vi.clearAllMocks());

describe('sampleVoiceover', () => {
  it('returns the decoded clip whatever format the server chose', async () => {
    synthesizeSpeech.mockResolvedValue(new ArrayBuffer(4));
    decodeClip.mockResolvedValue(BUFFER);

    expect(await sampleVoiceover(CONFIG, 'Hello')).toEqual({ ok: true, buffer: BUFFER });
    expect(synthesizeSpeech).toHaveBeenCalledWith(CONFIG, 'Hello', undefined);
  });

  it('reports the request error when the server refuses', async () => {
    synthesizeSpeech.mockRejectedValue(new SpeechError('Your server returned 400: Invalid model ID', 400, true));

    expect(await sampleVoiceover(CONFIG, 'Hello')).toEqual({
      ok: false,
      reason: 'failed',
      detail: 'Your server returned 400: Invalid model ID',
      suspectVoice: false,
    });
    expect(decodeClip).not.toHaveBeenCalled();
  });

  it('suspects the voice when a server fails without saying why', async () => {
    synthesizeSpeech.mockRejectedValue(new SpeechError('Your server returned 500: Internal Server Error', 500, false));
    expect(await sampleVoiceover(CONFIG, 'Hello')).toMatchObject({ reason: 'failed', suspectVoice: true });
  });

  it('suspects the voice when a server rejects the request without saying why', async () => {
    synthesizeSpeech.mockRejectedValue(new SpeechError('Your server returned 400: Bad Request', 400, false));
    expect(await sampleVoiceover(CONFIG, 'Hello')).toMatchObject({ suspectVoice: true });

    synthesizeSpeech.mockRejectedValue(new SpeechError('Your server returned 422: ', 422, false));
    expect(await sampleVoiceover(CONFIG, 'Hello')).toMatchObject({ suspectVoice: true });
  });

  it('points elsewhere than the voice for a bare not found', async () => {
    synthesizeSpeech.mockRejectedValue(new SpeechError('Your server returned 404: Not Found', 404, false));
    expect(await sampleVoiceover(CONFIG, 'Hello')).toMatchObject({ suspectVoice: false });
  });

  it('suspects the voice when a server never answers', async () => {
    synthesizeSpeech.mockRejectedValue(new DOMException('signal timed out', 'TimeoutError'));
    expect(await sampleVoiceover(CONFIG, 'Hello')).toEqual({
      ok: false,
      reason: 'failed',
      detail: 'signal timed out',
      suspectVoice: true,
    });
  });

  it('trusts a server error that carries its own message', async () => {
    synthesizeSpeech.mockRejectedValue(new SpeechError('Your server returned 503: Model is loading', 503, true));
    expect(await sampleVoiceover(CONFIG, 'Hello')).toMatchObject({ suspectVoice: false });
  });

  it('never blames the voice picked from a hosted provider list', async () => {
    synthesizeSpeech.mockRejectedValue(new SpeechError('OpenAI returned 500: Internal Server Error', 500, false));
    const sample = await sampleVoiceover({ ...CONFIG, provider: 'openai', baseUrl: undefined }, 'Hello');
    expect(sample).toMatchObject({ suspectVoice: false });
  });

  it('tells audio it cannot play apart from a failed request', async () => {
    synthesizeSpeech.mockResolvedValue(new ArrayBuffer(4));
    decodeClip.mockRejectedValue(new Error('Unable to decode audio data'));

    expect(await sampleVoiceover(CONFIG, 'Hello')).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('lets a cancelled test end quietly', async () => {
    synthesizeSpeech.mockRejectedValue(new DOMException('aborted', 'AbortError'));

    await expect(sampleVoiceover(CONFIG, 'Hello')).rejects.toMatchObject({ name: 'AbortError' });
  });
});
