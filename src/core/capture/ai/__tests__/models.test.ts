import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_PROVIDERS, CUSTOM_MODEL_VALUE, isCustomModel } from '../models';

const LOCALES = ['en', 'de', 'es', 'fr', 'pt-BR'];

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
  it('never collides with a real model id', () => {
    for (const config of Object.values(AI_PROVIDERS)) {
      expect(config.models.some((option) => option.id === CUSTOM_MODEL_VALUE)).toBe(false);
    }
  });

  it('never renders as the empty value Radix rejects for an item', () => {
    expect(CUSTOM_MODEL_VALUE.length).toBeGreaterThan(0);
  });
});

describe('every provider default is selectable', () => {
  it.each(Object.entries(AI_PROVIDERS))('%s lists its own default model', (_key, config) => {
    if (!config.baseUrl) {
      expect(config.models.some((option) => option.id === config.defaultModel)).toBe(true);
    }
  });
});

describe('openaiCompatible provider', () => {
  it('opts into a base URL and a free-text model', () => {
    const config = AI_PROVIDERS.openaiCompatible;
    expect(config.baseUrl).toBe(true);
    expect(isCustomModel('llama3:70b', config)).toBe(true);
    expect(isCustomModel('', config)).toBe(false);
  });

  it('carries the base URL label in every locale', () => {
    for (const locale of LOCALES) {
      expect(localeKeys(locale).has('settings.baseUrl')).toBe(true);
    }
  });
});

describe('model picker copy', () => {
  it.each(LOCALES)('%s carries every key the model picker renders', (locale) => {
    const keys = localeKeys(locale);
    for (const key of MODEL_KEYS) expect(keys).toContain(key);
  });
});
