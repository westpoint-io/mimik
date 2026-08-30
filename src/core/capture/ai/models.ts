export interface AIModelOption {
  id: string;
  label: string;
}

export interface AIModelOption {
  id: string;
  label: string;
}

export interface AIProviderConfig {
  label: string;
  defaultModel: string;
  models: AIModelOption[];
}

export const AI_PROVIDERS: Record<string, AIProviderConfig> = {
  openai: {
    label: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
    ],
  },
  anthropic: {
    label: 'Anthropic',
    defaultModel: 'claude-3-5-haiku-20241022',
    models: [
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    ],
  },
};

export type AIProviderKey = keyof typeof AI_PROVIDERS;

export const CUSTOM_MODEL_VALUE = 'mimik-custom-model';

export function isCustomModel(model: string, provider: AIProviderConfig): boolean {
  const id = model.trim();
  return id.length > 0 && !provider.models.some((option) => option.id === id);
}

// OpenAI-compatible custom profiles (multislot)
export const PROFILE_PREFIX = 'profile:';

export interface AIProfile {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function isProfileProvider(provider: string): boolean {
  return provider.startsWith(PROFILE_PREFIX);
}

export function getProfileId(provider: string): string {
  return provider.slice(PROFILE_PREFIX.length);
}

export function profileProviderId(id: string): string {
  return `${PROFILE_PREFIX}${id}`;
}

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function isLocalBaseUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return (
    u.includes('localhost') ||
    u.includes('127.0.0.1') ||
    u.includes('192.168.') ||
    u.includes('10.') ||
    u.startsWith('http://')
  );
}

export function makeProfileId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto.randomUUID() as string).slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}
