import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AI_PROVIDERS,
  CUSTOM_MODEL_VALUE,
  findProvider,
  isCustomBaseUrl,
  isCustomModel,
  isProviderKey,
  resolveBaseUrl,
} from '../models';

const LOCALES = ['en', 'de', 'es', 'fr', 'pt-BR', 'zh-CN'];

const MODEL_KEYS = ['settings.model', 'settings.modelCustom'];

function localeKeys(locale: string): Set<string> {
  const keys = new Set<string>();
  let section = '';
  for (const line of readFileSync(join(process.cwd(), 'src/locales', `${locale}.yml`), 'utf8').split('\n')) {
    const top = /^([\w-]+):/.exec(line);
    if (top) {
      section = top[1];
      continue;
    }
    const nested = /^ {2}([\w-]+):/.exec(line);
    if (nested && section) keys.add(`${section}.${nested[1]}`);
  }
  return keys;
}

describe('isCustomModel', () => {
  it('treats a curated model as not custom', () => {
    expect(isCustomModel('gpt-4o-mini', AI_PROVIDERS.openai)).toBe(false);
  });

  it('reopens a stored model the provider list does not carry', () => {
    expect(isCustomModel('gpt-4o-2024-11-20', AI_PROVIDERS.openai)).toBe(true);
  });

  it('reads a model from another provider as custom', () => {
    expect(isCustomModel('claude-3-5-haiku-20241022', AI_PROVIDERS.openai)).toBe(true);
  });

  it('falls back to the curated list when nothing is stored', () => {
    expect(isCustomModel('', AI_PROVIDERS.openai)).toBe(false);
    expect(isCustomModel('   ', AI_PROVIDERS.openai)).toBe(false);
  });
});

describe('custom model sentinel', () => {
  it('is present in every provider as a selectable option', () => {
    for (const config of Object.values(AI_PROVIDERS)) {
      if (config.models.length === 0) continue;
      expect(config.models.some((option) => option.id === CUSTOM_MODEL_VALUE)).toBe(true);
    }
  });

  it('never renders as the empty value Radix rejects for an item', () => {
    expect(CUSTOM_MODEL_VALUE.length).toBeGreaterThan(0);
  });
});

describe('every provider default is selectable', () => {
  it.each(Object.entries(AI_PROVIDERS))('%s lists its own default model', (_key, config) => {
    if (config.models.length === 0) return;
    expect(config.models.some((option) => option.id === config.defaultModel)).toBe(true);
  });
});

describe('every provider takes a custom server', () => {
  it.each(Object.entries(AI_PROVIDERS))('%s carries a default base URL and a protocol', (_key, config) => {
    expect(config.defaultBaseUrl).toMatch(/^https:\/\//);
    expect(['openai', 'anthropic']).toContain(config.protocol);
  });

  it('carries the custom server copy in every locale', () => {
    for (const locale of LOCALES) {
      const keys = localeKeys(locale);
      expect(keys.has('settings.baseUrl')).toBe(true);
      expect(keys.has('settings.useOwnServer')).toBe(true);
      expect(keys.has('settings.ownServerHintOpenai')).toBe(true);
      expect(keys.has('settings.ownServerHintAnthropic')).toBe(true);
    }
  });

  it('no longer offers a second OpenAI entry', () => {
    expect(Object.keys(AI_PROVIDERS)).not.toContain('openaiCompatible');
  });

  it('offers OpenRouter with its own endpoint and a model id the catalogue carries', () => {
    const config = AI_PROVIDERS.openrouter;
    expect(config.defaultBaseUrl).toBe('https://openrouter.ai/api/v1');
    expect(config.protocol).toBe('openai');
    expect(config.transport).toBe('chat');
    expect(config.keyCheckPath).toBe('/key');
    expect(config.defaultModel).toBe('openai/gpt-4o-mini');
    expect(config.models.some((m) => m.id.endsWith(':free'))).toBe(true);
    for (const option of config.models) {
      if (option.id === CUSTOM_MODEL_VALUE) continue;
      expect(option.id).toMatch(/^[a-z0-9-]+\/[\w.-]+(:[\w-]+)?$/);
    }
  });

  it('includes a Custom model option', () => {
    const config = AI_PROVIDERS.openai;
    expect(config.models.some((m) => m.id === CUSTOM_MODEL_VALUE)).toBe(true);
  });
});

describe('custom base URL detection', () => {
  it('reads a blank or default URL as not custom', () => {
    expect(isCustomBaseUrl(AI_PROVIDERS.openai, '')).toBe(false);
    expect(isCustomBaseUrl(AI_PROVIDERS.openai, undefined)).toBe(false);
    expect(isCustomBaseUrl(AI_PROVIDERS.openai, 'https://api.openai.com/v1')).toBe(false);
    expect(isCustomBaseUrl(AI_PROVIDERS.openai, 'https://api.openai.com/v1/')).toBe(false);
  });

  it('reads another host as custom, per provider', () => {
    expect(isCustomBaseUrl(AI_PROVIDERS.openai, 'http://localhost:11434/v1')).toBe(true);
    expect(isCustomBaseUrl(AI_PROVIDERS.anthropic, 'http://localhost:4000')).toBe(true);
    expect(isCustomBaseUrl(AI_PROVIDERS.deepseek, 'https://api.deepseek.com')).toBe(false);
  });

  it('resolves to the provider default when nothing is set', () => {
    expect(resolveBaseUrl(AI_PROVIDERS.deepseek)).toBe('https://api.deepseek.com');
    expect(resolveBaseUrl(AI_PROVIDERS.anthropic, '  ')).toBe('https://api.anthropic.com/v1');
    expect(resolveBaseUrl(AI_PROVIDERS.openai, 'http://localhost:8787/v1/')).toBe('http://localhost:8787/v1');
  });
});

describe('stored provider keys', () => {
  it('rejects a provider that no longer exists', () => {
    expect(isProviderKey('openaiCompatible')).toBe(false);
    expect(findProvider('openaiCompatible')).toBeUndefined();
  });

  it('accepts the ones that do', () => {
    expect(isProviderKey('openai')).toBe(true);
    expect(findProvider('deepseek')).toBe(AI_PROVIDERS.deepseek);
  });
});

describe('model picker copy', () => {
  it.each(LOCALES)('%s carries every key the model picker renders', (locale) => {
    const keys = localeKeys(locale);
    for (const key of MODEL_KEYS) expect(keys).toContain(key);
  });
});
