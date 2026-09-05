import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_PROVIDERS, CUSTOM_MODEL_VALUE, isCustomModel } from '../models';

const LOCALES = ['en', 'de', 'es', 'fr', 'pt-BR'];

const MODEL_KEYS = ['settings.model', 'settings.modelCustom', 'settings.endpoint', 'settings.endpointHint'];

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

const CURATED = Object.entries(AI_PROVIDERS).filter(([, config]) => !config.requiresEndpoint);
const ENDPOINT_DRIVEN = Object.entries(AI_PROVIDERS).filter(([, config]) => config.requiresEndpoint);

describe('every curated provider default is selectable', () => {
  it.each(CURATED)('%s lists its own default model', (_key, config) => {
    expect(config.models.some((option) => option.id === config.defaultModel)).toBe(true);
  });
});

describe('endpoint-driven providers', () => {
  it('exist, so the picker is not curated-only', () => {
    expect(ENDPOINT_DRIVEN.length).toBeGreaterThan(0);
  });

  it.each(ENDPOINT_DRIVEN)('%s curates no model list, because the ids are the user own deployments', (_key, config) => {
    expect(config.models).toEqual([]);
    expect(config.defaultModel).toBe('');
  });

  it.each(ENDPOINT_DRIVEN)('%s shows an example url so the field is not a blank guess', (_key, config) => {
    expect(config.endpointExample).toBeTruthy();
  });

  it.each(ENDPOINT_DRIVEN)('%s opens the free-text model box, having nothing to pick from', (_key, config) => {
    expect(isCustomModel('some-deployment-name', config)).toBe(true);
  });
});

describe('model picker copy', () => {
  it.each(LOCALES)('%s carries every key the model picker renders', (locale) => {
    const keys = localeKeys(locale);
    for (const key of MODEL_KEYS) expect(keys).toContain(key);
  });
});
