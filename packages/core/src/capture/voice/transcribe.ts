import { normalizeBaseUrl } from '@/core/capture/ai/models';
import { coreFetch } from '@/core/env';
import type { TranscriptionResponse } from './types';

export type VoiceProvider = 'openai' | 'groq' | 'server';

export interface TranscribeConfig {
  provider: VoiceProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  language?: string;
}

const PROVIDERS: Record<Exclude<VoiceProvider, 'server'>, { url: string; model: string }> = {
  openai: { url: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' },
  groq: { url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3' },
};

const SERVER_MODEL = 'whisper-1';

const ERROR_BODY_LIMIT = 200;

function endpointFor(config: TranscribeConfig): { url: string; model: string } {
  if (config.provider !== 'server') return PROVIDERS[config.provider] ?? PROVIDERS.openai;
  return {
    url: `${normalizeBaseUrl(config.baseUrl ?? '')}/audio/transcriptions`,
    model: config.model?.trim() || SERVER_MODEL,
  };
}

export function createTranscriber(config: TranscribeConfig): (wav: Blob) => Promise<TranscriptionResponse> {
  const { url, model } = endpointFor(config);
  const headers: Record<string, string> = config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {};

  return async (wav: Blob): Promise<TranscriptionResponse> => {
    const form = new FormData();
    form.append('file', wav, 'audio.wav');
    form.append('model', model);
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    form.append('timestamp_granularities[]', 'segment');
    form.append('temperature', '0');
    if (config.language) form.append('language', config.language);

    const response = await coreFetch(url, {
      method: 'POST',
      headers,
      body: form,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Transcription failed with ${response.status}: ${body.slice(0, ERROR_BODY_LIMIT)}`);
    }

    const result = (await response.json()) as TranscriptionResponse;
    if (!Array.isArray(result.segments)) {
      throw new Error('Transcription response has no segments; verbose_json is required');
    }

    return result;
  };
}
