import { logger } from '@/lib/logger';
import { DEFAULT_OPENAI_BASE_URL } from './models';

export type KeyValidation =
  | { valid: true; models?: string[] }
  | { valid: false; reason: 'rejected' | 'network' | 'model-required' | 'model-invalid'; models?: string[] };

const REQUEST_TIMEOUT_MS = 10_000;

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function isOpenAIEndpoint(baseUrl?: string): boolean {
  if (!baseUrl?.trim()) return true;
  return normalizeUrl(baseUrl) === normalizeUrl(DEFAULT_OPENAI_BASE_URL);
}

const ENDPOINTS: Record<string, { url?: string; headers: (key: string) => Record<string, string> }> = {
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
  deepseek: {
    url: 'https://api.deepseek.com/models',
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
};

function parseModelIds(body: unknown): string[] | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return undefined;
  const models = data
    .map((entry) => (typeof entry === 'object' && entry !== null ? (entry as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  return models.length > 0 ? models : undefined;
}

async function fetchModelsFromUrl(url: string, headers: Record<string, string>): Promise<string[] | undefined> {
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return undefined;
    return parseModelIds(await res.json().catch(() => null));
  } catch (err) {
    logger.error('Model catalog request failed', err);
    return undefined;
  }
}

async function probeWithChatCompletion(
  baseUrl: string,
  model: string,
  headers: Record<string, string>,
): Promise<boolean> {
  try {
    const chatUrl = `${normalizeUrl(baseUrl)}/chat/completions`;
    const res = await fetch(chatUrl, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        max_tokens: 8,
        stream: false,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function validateApiKey(
  provider: string,
  apiKey: string,
  baseUrl?: string,
  model?: string,
): Promise<KeyValidation> {
  if (provider === 'openai' && !isOpenAIEndpoint(baseUrl)) {
    const trimmedBase = baseUrl?.trim();
    if (!trimmedBase) {
      logger.error('OpenAI provider with no base URL');
      return { valid: false, reason: 'network' };
    }

    const headers = { Authorization: `Bearer ${apiKey}` };

    const selectedModel = model?.trim();
    if (!selectedModel) {
      const models = await fetchModelsFromUrl(`${normalizeUrl(trimmedBase)}/models`, headers);
      return models ? { valid: false, reason: 'model-required', models } : { valid: false, reason: 'model-required' };
    }

    const probeOk = await probeWithChatCompletion(trimmedBase, selectedModel, headers);
    if (!probeOk) {
      const models = await fetchModelsFromUrl(`${normalizeUrl(trimmedBase)}/models`, headers);
      if (models && !models.includes(selectedModel)) {
        return { valid: false, reason: 'model-invalid', models };
      }
      return { valid: false, reason: 'rejected' };
    }

    const models = await fetchModelsFromUrl(`${normalizeUrl(trimmedBase)}/models`, headers);
    return models ? { valid: true, models } : { valid: true };
  }

  const endpoint = ENDPOINTS[provider];
  const url = endpoint?.url ?? null;
  if (!url) {
    logger.error('No API key validation endpoint for provider', provider);
    return { valid: false, reason: 'network' };
  }
  try {
    const res = await fetch(url, {
      headers: endpoint.headers(apiKey),
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
