import { logger } from '@/lib/logger';
import {
  type AIProtocol,
  type AIProviderConfig,
  findProvider,
  isCustomBaseUrl,
  normalizeBaseUrl,
  resolveBaseUrl,
} from './models';

export type KeyWarning = 'cannot-spend';

export type KeyValidation =
  | { valid: true; models?: string[]; warning?: KeyWarning }
  | { valid: false; reason: 'rejected' | 'network' | 'model-required' | 'model-invalid'; models?: string[] };

const REQUEST_TIMEOUT_MS = 10_000;

const PROTOCOL_HEADERS: Record<AIProtocol, (key: string) => Record<string, string>> = {
  openai: (key) => ({ Authorization: `Bearer ${key}` }),
  anthropic: (key) => ({
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }),
};

const VOICE_ENDPOINTS: Record<string, { url: string; headers: (key: string) => Record<string, string> }> = {
  groq: {
    url: 'https://api.groq.com/openai/v1/models',
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

type AuthProbe = { valid: true; body: unknown } | { valid: false; reason: 'rejected' | 'network' };

async function probeAuth(url: string, headers: Record<string, string>): Promise<AuthProbe> {
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.ok) return { valid: true, body: await res.json().catch(() => null) };
    if (res.status === 401 || res.status === 403) return { valid: false, reason: 'rejected' };
    return { valid: false, reason: 'network' };
  } catch (err) {
    logger.error('API key validation request failed', err);
    return { valid: false, reason: 'network' };
  }
}

async function checkCatalog(url: string, headers: Record<string, string>): Promise<KeyValidation> {
  const probe = await probeAuth(url, headers);
  if (!probe.valid) return probe;
  const models = parseModelIds(probe.body);
  return models ? { valid: true, models } : { valid: true };
}

export function spendWarning(body: unknown): KeyWarning | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const data = (body as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return undefined;
  const key = data as { is_free_tier?: unknown; limit_remaining?: unknown };
  if (key.is_free_tier === true) return 'cannot-spend';
  if (typeof key.limit_remaining === 'number' && key.limit_remaining <= 0) return 'cannot-spend';
  return undefined;
}

async function probeWithInference(
  protocol: AIProtocol,
  baseUrl: string,
  model: string,
  headers: Record<string, string>,
): Promise<boolean> {
  const base = normalizeBaseUrl(baseUrl);
  const url = protocol === 'anthropic' ? `${base}/messages` : `${base}/chat/completions`;
  const body =
    protocol === 'anthropic'
      ? { model, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with OK.' }] }
      : { model, messages: [{ role: 'user', content: 'Reply with OK.' }], max_tokens: 8, stream: false };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function validateCustomServer(
  config: AIProviderConfig,
  apiKey: string,
  baseUrl: string,
  model?: string,
): Promise<KeyValidation> {
  const headers = PROTOCOL_HEADERS[config.protocol](apiKey);
  const base = normalizeBaseUrl(baseUrl);
  const catalogUrl = `${base}/models`;

  const selectedModel = model?.trim();
  if (!selectedModel) {
    const models = await fetchModelsFromUrl(catalogUrl, headers);
    return models ? { valid: false, reason: 'model-required', models } : { valid: false, reason: 'model-required' };
  }

  if (await probeWithInference(config.protocol, base, selectedModel, headers)) {
    const models = await fetchModelsFromUrl(catalogUrl, headers);
    return models ? { valid: true, models } : { valid: true };
  }

  const models = await fetchModelsFromUrl(catalogUrl, headers);
  if (models && !models.includes(selectedModel)) return { valid: false, reason: 'model-invalid', models };
  return { valid: false, reason: 'rejected' };
}

export async function validateApiKey(
  provider: string,
  apiKey: string,
  baseUrl?: string,
  model?: string,
): Promise<KeyValidation> {
  const config = findProvider(provider);

  if (!config) {
    const endpoint = VOICE_ENDPOINTS[provider];
    if (!endpoint) {
      logger.error('No API key validation endpoint for provider', provider);
      return { valid: false, reason: 'network' };
    }
    return checkCatalog(endpoint.url, endpoint.headers(apiKey));
  }

  if (isCustomBaseUrl(config, baseUrl)) return validateCustomServer(config, apiKey, baseUrl as string, model);

  const headers = PROTOCOL_HEADERS[config.protocol](apiKey);
  const base = resolveBaseUrl(config);
  const catalogUrl = `${base}/models`;
  if (!config.keyCheckPath) return checkCatalog(catalogUrl, headers);

  const authenticated = await probeAuth(`${base}${config.keyCheckPath}`, headers);
  if (!authenticated.valid) return authenticated;

  const warning = spendWarning(authenticated.body);
  const models = await fetchModelsFromUrl(catalogUrl, headers);
  return { valid: true, ...(models ? { models } : {}), ...(warning ? { warning } : {}) };
}
