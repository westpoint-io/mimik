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
  openrouter: {
    label: 'OpenRouter',
    defaultModel: 'openai/gpt-4o-mini',
    models: [
      { id: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o Mini' },
      { id: 'openai/gpt-4o', label: 'OpenAI GPT-4o' },
      { id: 'openai/gpt-4.1', label: 'OpenAI GPT-4.1' },
      { id: 'anthropic/claude-3-5-haiku', label: 'Anthropic Claude 3.5 Haiku' },
      { id: 'anthropic/claude-sonnet-4', label: 'Anthropic Claude Sonnet 4' },
      { id: 'google/gemini-2.0-flash-001', label: 'Google Gemini 2.0 Flash' },
      { id: 'google/gemini-2.5-flash-preview', label: 'Google Gemini 2.5 Flash' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
      { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
      { id: 'mistral/mistral-small-3.1-24b', label: 'Mistral Small 3.1' },
      { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B' },
    ],
  },
};

export type AIProviderKey = keyof typeof AI_PROVIDERS;
