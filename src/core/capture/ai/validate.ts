import { logger } from '@/lib/logger';

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
  // /models is public on OpenRouter and answers 200 for any key, so check the
  // key against /key, which is the endpoint that actually authenticates.
  openrouter: {
    url: 'https://openrouter.ai/api/v1/key',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
};

export async function validateApiKey(provider: string, apiKey: string): Promise<KeyValidation> {
  const endpoint = ENDPOINTS[provider];
  if (!endpoint) {
    logger.error('No API key validation endpoint for provider', provider);
    return { valid: false, reason: 'network' };
  }
  try {
    const res = await fetch(endpoint.url, {
      headers: endpoint.headers(apiKey),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.ok) return { valid: true };
    if (res.status === 401 || res.status === 403) return { valid: false, reason: 'rejected' };
    return { valid: false, reason: 'network' };
  } catch (err) {
    logger.error('API key validation request failed', err);
    return { valid: false, reason: 'network' };
  }
}
