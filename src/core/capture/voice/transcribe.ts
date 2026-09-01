import type { TranscriptionResponse } from './types';

export type VoiceProvider = 'openai' | 'groq';

export interface TranscribeConfig {
  provider: VoiceProvider;
  apiKey: string;
  language?: string;
  baseUrl?: string;
  model?: string;
}

const PROVIDERS: Record<VoiceProvider, { url: string; model: string }> = {
  openai: { url: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' },
  groq: { url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3' },
};

function buildTranscriptionUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    return new URL('/v1/audio/transcriptions', trimmed.endsWith('/') ? trimmed : `${trimmed}/`).toString();
  } catch {
    if (trimmed.endsWith('/v1')) return `${trimmed}/audio/transcriptions`;
    if (trimmed.includes('/v1')) return `${trimmed.replace(/\/+$/, '')}/audio/transcriptions`;
    return `${trimmed}/v1/audio/transcriptions`;
  }
}

const ERROR_BODY_LIMIT = 200;

export function createTranscriber(config: TranscribeConfig): (wav: Blob) => Promise<TranscriptionResponse> {
  const fallback = PROVIDERS[config.provider] ?? PROVIDERS.openai;
  const url = config.baseUrl ? buildTranscriptionUrl(config.baseUrl) : fallback.url;
  const model = config.model?.trim() ? config.model.trim() : fallback.model;

  return async (wav: Blob): Promise<TranscriptionResponse> => {
    const form = new FormData();
    form.append('file', wav, 'audio.wav');
    form.append('model', model);
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    form.append('timestamp_granularities[]', 'segment');
    form.append('temperature', '0');
    if (config.language) form.append('language', config.language);

    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}` },
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
