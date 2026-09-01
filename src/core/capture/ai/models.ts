export interface AIModelOption {
  id: string;
  label: string;
}

export interface AIProviderConfig {
  label: string;
  defaultModel: string;
  models: AIModelOption[];
  /** Whether this provider uses a custom base URL (e.g. OpenAI-compatible endpoints). */
  baseUrl?: boolean;
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
  openaiCompatible: {
    label: 'OpenAI Compatible',
    defaultModel: 'gpt-4o-mini',
    models: [],
    baseUrl: true,
  },
};

export type AIProviderKey = keyof typeof AI_PROVIDERS;

export const CUSTOM_MODEL_VALUE = 'mimik-custom-model';

export function isCustomModel(model: string, provider: AIProviderConfig): boolean {
  const id = model.trim();
  return id.length > 0 && !provider.models.some((option) => option.id === id);
}
