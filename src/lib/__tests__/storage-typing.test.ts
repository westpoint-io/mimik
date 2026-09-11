import { describe, expectTypeOf, it } from 'vitest';
import type { Settings } from '@/core/guides/types';
import { localStorage } from '@/lib/browser-api';

describe('storage access is checked against the declared settings', () => {
  it('returns the declared type for a key, not unknown', async () => {
    const stored = await localStorage.get(['aiProvider', 'aiApiKeys']);
    expectTypeOf(stored.aiProvider).toEqualTypeOf<Settings['aiProvider'] | undefined>();
    expectTypeOf(stored.aiApiKeys).toEqualTypeOf<Settings['aiApiKeys'] | undefined>();
  });

  it('rejects a key that is not declared', () => {
    // @ts-expect-error an undeclared storage key must not compile
    void localStorage.get(['aiApiKeyTypo']);
    // @ts-expect-error an undeclared storage key must not compile
    void localStorage.set({ aiApiKeyTypo: 'x' });
  });

  it('rejects the wrong type for a declared key', () => {
    // @ts-expect-error aiProvider is a provider key, not an arbitrary string
    void localStorage.set({ aiProvider: 'not-a-provider' });
    // @ts-expect-error voiceEnabled is a boolean
    void localStorage.set({ voiceEnabled: 'yes' });
  });
});
