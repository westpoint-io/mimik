export interface AIModelOption {
  id: string;
  label: string;
}

export type AIProtocol = 'openai' | 'anthropic';

export type OpenAITransport = 'responses' | 'chat';

export interface AIProviderConfig {
  label: string;
  protocol: AIProtocol;
  transport?: OpenAITransport;
  defaultBaseUrl: string;
  defaultModel: string;
  models: AIModelOption[];
}

export const CUSTOM_MODEL_VALUE = 'mimik-custom-model';

export const AI_PROVIDERS = {
  openai: {
    label: 'OpenAI',
    protocol: 'openai',
    transport: 'responses',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: CUSTOM_MODEL_VALUE, label: 'Custom' },
    ],
  },
  anthropic: {
    label: 'Anthropic',
    protocol: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-20241022',
    models: [
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { id: CUSTOM_MODEL_VALUE, label: 'Custom' },
    ],
  },
  deepseek: {
    label: 'DeepSeek',
    protocol: 'openai',
    transport: 'chat',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-flash',
    models: [
      { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
      { id: 'deepseek-v4-flash-vision-exp', label: 'DeepSeek V4 Flash Vision Exp' },
      { id: CUSTOM_MODEL_VALUE, label: 'Custom' },
    ],
  },
} satisfies Record<string, AIProviderConfig>;

export type AIProviderKey = keyof typeof AI_PROVIDERS;

export const DEFAULT_AI_PROVIDER: AIProviderKey = 'openai';

export function isProviderKey(value: unknown): value is AIProviderKey {
  return typeof value === 'string' && value in AI_PROVIDERS;
}

export function findProvider(provider: string): AIProviderConfig | undefined {
  return isProviderKey(provider) ? AI_PROVIDERS[provider] : undefined;
}

export function providerOrDefault(value: unknown): AIProviderKey {
  return isProviderKey(value) ? value : DEFAULT_AI_PROVIDER;
}

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function resolveBaseUrl(config: AIProviderConfig, baseUrl?: string): string {
  return normalizeBaseUrl(baseUrl?.trim() || config.defaultBaseUrl);
}

export function isCustomBaseUrl(config: AIProviderConfig, baseUrl?: string): boolean {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return false;
  return normalizeBaseUrl(trimmed) !== normalizeBaseUrl(config.defaultBaseUrl);
}

export function openAITransport(config: AIProviderConfig, baseUrl?: string): OpenAITransport {
  return isCustomBaseUrl(config, baseUrl) ? 'chat' : (config.transport ?? 'chat');
}

export function isCustomModel(model: string, provider: AIProviderConfig): boolean {
  const id = model.trim();
  return id.length > 0 && !provider.models.some((option) => option.id === id);
}
