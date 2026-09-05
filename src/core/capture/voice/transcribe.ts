import { normalizeEndpoint } from '@/core/capture/ai/endpoint';
import type { TranscriptionResponse } from './types';

export type VoiceProvider = 'openai' | 'groq' | 'azure';

export interface TranscribeConfig {
  provider: VoiceProvider;
  apiKey: string;
  language?: string;
  baseURL?: string;
  model?: string;
}

const PROVIDERS: Record<'openai' | 'groq', { url: string; model: string }> = {
  openai: { url: 'https://api.openai.com/v1/audio/transcriptions', model: 'whisper-1' },
  groq: { url: 'https://api.groq.com/openai/v1/audio/transcriptions', model: 'whisper-large-v3' },
};

const ERROR_BODY_LIMIT = 200;

function resolveRequest(config: TranscribeConfig): { url: string; model: string; headers: Record<string, string> } {
  if (config.provider === 'azure') {
    const endpoint = normalizeEndpoint('azure', config.baseURL ?? '');
    const model = config.model?.trim() ?? '';
    if (!endpoint) throw new Error('Azure voice transcription requires an endpoint');
    if (!model) throw new Error('Azure voice transcription requires a deployment name');

    return {
      url: `${endpoint}/deployments/${model}/audio/transcriptions?api-version=2024-06-01`,
      model,
      headers: { 'api-key': config.apiKey },
    };
  }

  const { url, model } = PROVIDERS[config.provider] ?? PROVIDERS.openai;
  return { url, model, headers: { Authorization: `Bearer ${config.apiKey}` } };
}

export function createTranscriber(config: TranscribeConfig): (wav: Blob) => Promise<TranscriptionResponse> {
  return async (wav: Blob): Promise<TranscriptionResponse> => {
    const { url, model, headers } = resolveRequest(config);

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
