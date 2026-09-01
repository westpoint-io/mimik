import { logger } from '@/lib/logger';

export type KeyValidation =
  | { valid: true; models?: string[] }
  | { valid: false; reason: 'rejected' | 'network' | 'model-required' | 'model-invalid'; models?: string[] };

const REQUEST_TIMEOUT_MS = 10_000;

const ENDPOINTS: Record<string, { url?: string; baseUrl?: boolean; headers: (key: string) => Record<string, string> }> =
  {
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
    openaiCompatible: {
      baseUrl: true,
      headers: (key) => ({ Authorization: `Bearer ${key}` }),
    },
  };

function endpointUrl(provider: string, baseUrl?: string): string | null {
  const endpoint = ENDPOINTS[provider];
  if (!endpoint) return null;
  if (endpoint.baseUrl) {
    const trimmed = baseUrl?.trim().replace(/\/+$/, '');
    return trimmed ? `${trimmed}/models` : null;
  }
  return endpoint.url ?? null;
}

function compatibleChatUrl(baseUrl?: string): string | null {
  const trimmed = baseUrl?.trim().replace(/\/+$/, '');
  return trimmed ? `${trimmed}/chat/completions` : null;
}

/** OpenAI, Anthropic and Groq all list models as `{ data: [{ id }] }`. */
function parseModelIds(body: unknown): string[] | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return undefined;
  const models = data
    .map((entry) => (typeof entry === 'object' && entry !== null ? (entry as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  return models.length > 0 ? models : undefined;
}

async function fetchCompatibleModels(apiKey: string, baseUrl?: string): Promise<string[] | undefined> {
  const url = endpointUrl('openaiCompatible', baseUrl);
  if (!url) return undefined;

  try {
    const catalog = await fetch(url, {
      headers: ENDPOINTS.openaiCompatible.headers(apiKey),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!catalog.ok) return undefined;
    return parseModelIds(await catalog.json().catch(() => null));
  } catch (err) {
    logger.error('Compatible model catalog request failed', err);
    return undefined;
  }
}

export async function validateApiKey(
  provider: string,
  apiKey: string,
  baseUrl?: string,
  model?: string,
): Promise<KeyValidation> {
  if (provider === 'openaiCompatible') {
    const chatUrl = compatibleChatUrl(baseUrl);
    const catalogUrl = endpointUrl(provider, baseUrl);
    const selectedModel = model?.trim();
    if (!chatUrl || !catalogUrl) {
      logger.error('No API key validation endpoint or model for provider', provider);
      return { valid: false, reason: 'network' };
    }

    if (!selectedModel) {
      const models = await fetchCompatibleModels(apiKey, baseUrl);
      return models ? { valid: false, reason: 'model-required', models } : { valid: false, reason: 'model-required' };
    }

    let result: KeyValidation;
    try {
      const probe = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          ...ENDPOINTS[provider].headers(apiKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: 'Reply with OK.' }],
          max_tokens: 8,
          stream: false,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!probe.ok) {
        result =
          probe.status === 401 || probe.status === 403
            ? { valid: false, reason: 'rejected' }
            : { valid: false, reason: 'network' };
      } else {
        result = { valid: true };
      }
    } catch (err) {
      logger.error('API key validation request failed', err);
      result = { valid: false, reason: 'network' };
    }

    const models = await fetchCompatibleModels(apiKey, baseUrl);
    if (!result.valid && models && !models.includes(selectedModel)) {
      return { valid: false, reason: 'model-invalid', models };
    }
    return models ? { ...result, models } : result;
  }

  const url = endpointUrl(provider, baseUrl);
  if (!url) {
    logger.error('No API key validation endpoint for provider', provider);
    return { valid: false, reason: 'network' };
  }
  try {
    const res = await fetch(url, {
      headers: ENDPOINTS[provider].headers(apiKey),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.ok) {
      const body = await res.json().catch(() => null);
      const models = parseModelIds(body);
      return models ? { valid: true, models } : { valid: true };
    }
    if (res.status === 401 || res.status === 403) return { valid: false, reason: 'rejected' };
    return { valid: false, reason: 'network' };
  } catch (err) {
    logger.error('API key validation request failed', err);
    return { valid: false, reason: 'network' };
  }
}
