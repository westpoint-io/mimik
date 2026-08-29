import { logger } from '@/lib/logger';
import { normalizeEndpoint } from './endpoint';

export type KeyValidation = { valid: true } | { valid: false; reason: 'rejected' | 'network' };

const REQUEST_TIMEOUT_MS = 10_000;

const ENDPOINTS: Record<string, { url: string; headers: (key: string) => Record<string, string> }> = {
  openai: {
    url: 'https://api.openai.com/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/models',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
};

async function fetchValidation(url: string, headers: Record<string, string>): Promise<KeyValidation> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (res.ok) return { valid: true };
    if (res.status === 401 || res.status === 403) return { valid: false, reason: 'rejected' };
    return { valid: false, reason: 'network' };
  } catch (err) {
    logger.error('API key validation request failed', err);
    return { valid: false, reason: 'network' };
  }
}

export async function validateApiKey(provider: string, apiKey: string, baseURL?: string): Promise<KeyValidation> {
  if (provider === 'azure') {
    const normalized = normalizeEndpoint('azure', baseURL ?? '');
    if (!normalized) return { valid: false, reason: 'network' };
    return fetchValidation(`${normalized}/v1/models?api-version=v1`, { 'api-key': apiKey });
  }

  const endpoint = ENDPOINTS[provider];
  if (!endpoint) {
    logger.error('No API key validation endpoint for provider', provider);
    return { valid: false, reason: 'network' };
  }
  return fetchValidation(endpoint.url, endpoint.headers(apiKey));
}
