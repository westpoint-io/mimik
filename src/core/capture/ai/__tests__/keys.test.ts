import { describe, expect, it } from 'vitest';
import { keyFor, migrateApiKeys, parseApiKeys, resolveAiKey, withKeyFor } from '../keys';

describe('parseApiKeys', () => {
  it('keeps only keys for providers that exist', () => {
    expect(parseApiKeys({ openai: 'sk-a', openaiCompatible: 'sk-gone', anthropic: 'ak-b' })).toEqual({
      openai: 'sk-a',
      anthropic: 'ak-b',
    });
  });

  it('drops blank keys and non-strings', () => {
    expect(parseApiKeys({ openai: '   ', anthropic: 42, deepseek: 'sk-c' })).toEqual({ deepseek: 'sk-c' });
  });

  it('reads anything that is not an object as no keys', () => {
    expect(parseApiKeys(null)).toEqual({});
    expect(parseApiKeys('sk-loose')).toEqual({});
    expect(parseApiKeys(undefined)).toEqual({});
  });
});

describe('migrateApiKeys', () => {
  it('attaches a pre-existing single key to the provider that was selected', () => {
    expect(migrateApiKeys({ aiApiKey: 'sk-legacy', aiProvider: 'anthropic' })).toEqual({ anthropic: 'sk-legacy' });
  });

  it('attaches a legacy key to openai when the stored provider is gone', () => {
    expect(migrateApiKeys({ aiApiKey: 'sk-legacy', aiProvider: 'openaiCompatible' })).toEqual({ openai: 'sk-legacy' });
  });

  it('prefers the per-provider map once it exists', () => {
    expect(migrateApiKeys({ aiApiKeys: { openai: 'sk-new' }, aiApiKey: 'sk-legacy', aiProvider: 'anthropic' })).toEqual(
      { openai: 'sk-new' },
    );
  });

  it('returns nothing when no key was ever saved', () => {
    expect(migrateApiKeys({})).toEqual({});
    expect(migrateApiKeys({ aiApiKey: '  ' })).toEqual({});
  });
});

describe('keyFor and withKeyFor', () => {
  it('reads a provider with no key as empty rather than undefined', () => {
    expect(keyFor({ openai: 'sk-a' }, 'anthropic')).toBe('');
  });

  it('stores a key against one provider without touching the others', () => {
    const next = withKeyFor({ openai: 'sk-a' }, 'anthropic', 'ak-b');
    expect(next).toEqual({ openai: 'sk-a', anthropic: 'ak-b' });
  });

  it('clearing one provider leaves the others intact', () => {
    expect(withKeyFor({ openai: 'sk-a', anthropic: 'ak-b' }, 'anthropic', '')).toEqual({ openai: 'sk-a' });
    expect(withKeyFor({ openai: 'sk-a', anthropic: 'ak-b' }, 'anthropic', '   ')).toEqual({ openai: 'sk-a' });
  });
});

describe('resolveAiKey', () => {
  it('hands back the key belonging to the selected provider, never another', () => {
    const stored = { aiApiKeys: { openai: 'sk-openai', anthropic: 'ak-anthropic' }, aiProvider: 'anthropic' };
    expect(resolveAiKey(stored)).toEqual({ provider: 'anthropic', apiKey: 'ak-anthropic' });
  });

  it('reports no key rather than a neighbour key when the selected provider has none', () => {
    const stored = { aiApiKeys: { openai: 'sk-openai' }, aiProvider: 'openrouter' };
    expect(resolveAiKey(stored)).toEqual({ provider: 'openrouter', apiKey: '' });
  });

  it('falls back to openai for an unknown stored provider', () => {
    expect(resolveAiKey({ aiApiKeys: { openai: 'sk-a' }, aiProvider: 'nope' })).toEqual({
      provider: 'openai',
      apiKey: 'sk-a',
    });
  });
});
