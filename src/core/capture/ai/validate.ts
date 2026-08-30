import { logger } from '@/lib/logger';
import { normalizeBaseUrl } from './models';

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

function buildModelsUrl(baseUrl: string): string {
  const trimmed = normalizeBaseUrl(baseUrl);
  if (!trimmed) return '';
  try {
    return new URL('/v1/models', trimmed.endsWith('/') ? trimmed : `${trimmed}/`).toString();
  } catch {
    // fallback simple join if URL constructor fails (e.g. missing scheme during test)
    const sep = trimmed.endsWith('/') ? '' : '/';
    // if baseUrl already ends with /v1 or /v1/, just append /models
    if (trimmed.endsWith('/v1')) return `${trimmed}/models`;
    if (trimmed.endsWith('/v1/')) return `${trimmed}models`;
    // heuristic: if trimmed contains /v1 already, append /models
    if (trimmed.includes('/v1')) return `${trimmed}${sep}models`;
    return `${trimmed}${sep}v1/models`;
  }
}

export async function validateApiKey(provider: string, apiKey: string, baseUrl?: string): Promise<KeyValidation> {
  const trimmedBase = baseUrl ? normalizeBaseUrl(baseUrl) : '';

  // Custom / profile providers or openai with explicit baseUrl override use OpenAI-spec /models
  if (provider.startsWith('profile:') || provider === 'openai-compatible' || provider === 'custom') {
    if (!trimmedBase) {
      logger.error('No baseUrl for custom provider', provider);
      return { valid: false, reason: 'network' };
    }
    const url = buildModelsUrl(trimmedBase);
    return fetchWithAuth(url, apiKey);
  }

  if (provider === 'openai' && trimmedBase) {
    const url = buildModelsUrl(trimmedBase);
    return fetchWithAuth(url, apiKey);
  }

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

async function fetchWithAuth(url: string, apiKey: string): Promise<KeyValidation> {
  try {
    const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    const res = await fetch(url, {
      headers,
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
