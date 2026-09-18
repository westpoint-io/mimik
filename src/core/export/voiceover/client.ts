import type { VoiceoverConfig } from './config';
import { type VoiceoverProviderKey, type VoiceoverVoice, voiceoverProvider } from './providers';

const ERROR_BODY_LIMIT = 200;
const REQUEST_TIMEOUT_MS = 60_000;

export interface SpeechRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

function authHeaders(provider: VoiceoverProviderKey, apiKey: string): Record<string, string> {
  return provider === 'elevenlabs' ? { 'xi-api-key': apiKey } : { Authorization: `Bearer ${apiKey}` };
}

export function speechRequest(config: VoiceoverConfig, text: string): SpeechRequest {
  const base = voiceoverProvider(config.provider).defaultBaseUrl;
  const headers = { ...authHeaders(config.provider, config.apiKey), 'Content-Type': 'application/json' };

  if (config.provider === 'elevenlabs') {
    return {
      url: `${base}/text-to-speech/${encodeURIComponent(config.voiceId)}?output_format=mp3_44100_128`,
      headers,
      body: JSON.stringify({ text, model_id: config.modelId }),
    };
  }

  return {
    url: `${base}/audio/speech`,
    headers,
    body: JSON.stringify({ model: config.modelId, voice: config.voiceId, input: text, response_format: 'mp3' }),
  };
}

function timeout(signal?: AbortSignal): AbortSignal {
  const limit = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return signal ? AbortSignal.any([signal, limit]) : limit;
}

export async function synthesizeSpeech(
  config: VoiceoverConfig,
  text: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const request = speechRequest(config, text);
  const response = await fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: request.body,
    signal: timeout(signal),
  });

  if (!response.ok) {
    const label = voiceoverProvider(config.provider).label;
    if (response.status === 401 || response.status === 403) {
      throw new Error(`${label} rejected the API key (${response.status})`);
    }
    const body = await response.text().catch(() => '');
    throw new Error(`${label} returned ${response.status}: ${body.slice(0, ERROR_BODY_LIMIT)}`);
  }

  return response.arrayBuffer();
}

export function parseVoices(body: unknown): VoiceoverVoice[] {
  if (typeof body !== 'object' || body === null) return [];
  const list = (body as { voices?: unknown }).voices;
  if (!Array.isArray(list)) return [];
  return list
    .map((entry) => {
      if (typeof entry !== 'object' || entry === null) return null;
      const { voice_id: id, name } = entry as { voice_id?: unknown; name?: unknown };
      if (typeof id !== 'string' || !id) return null;
      return { id, name: typeof name === 'string' && name ? name : id };
    })
    .filter((voice): voice is VoiceoverVoice => voice !== null);
}

export async function fetchVoices(
  provider: VoiceoverProviderKey,
  apiKey: string,
  signal?: AbortSignal,
): Promise<VoiceoverVoice[]> {
  const config = voiceoverProvider(provider);
  if (!config.catalog) return config.voices;

  const response = await fetch(`${config.defaultBaseUrl}/voices`, {
    headers: authHeaders(provider, apiKey),
    signal: timeout(signal),
  });
  if (!response.ok) throw new Error(`${config.label} returned ${response.status}`);
  return parseVoices(await response.json().catch(() => null));
}
