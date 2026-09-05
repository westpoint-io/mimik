import { describe, expect, it, vi } from 'vitest';

const storageMock = vi.fn();

vi.mock('../browser-api', () => ({
  localStorage: { get: (keys: string[]) => storageMock(keys) },
}));

import { readTranscriptionSettings } from '../voice-narration';

describe('readTranscriptionSettings', () => {
  it('wires the stored azure endpoint and deployment through to the transcriber config', async () => {
    storageMock.mockResolvedValue({
      voiceProvider: 'azure',
      voiceApiKey: 'az-key',
      voiceBaseUrl: 'https://my-res.openai.azure.com',
      voiceModel: 'my-deployment',
    });

    const settings = await readTranscriptionSettings();

    expect(settings.provider).toBe('azure');
    expect(settings.apiKey).toBe('az-key');
    expect(settings.baseURL).toBe('https://my-res.openai.azure.com');
    expect(settings.model).toBe('my-deployment');
  });

  it('leaves baseURL and model undefined for a plain openai setup', async () => {
    storageMock.mockResolvedValue({
      voiceProvider: 'openai',
      voiceApiKey: 'sk-voice',
    });

    const settings = await readTranscriptionSettings();

    expect(settings.provider).toBe('openai');
    expect(settings.baseURL).toBeUndefined();
    expect(settings.model).toBeUndefined();
  });
});
