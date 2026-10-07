import { beforeEach, describe, expect, it } from 'vitest';
import { dexieStore } from '../dexie-store';
import { createGuide, getGuides } from '../service';
import { configureStore, resetStore, store } from '../store';
import type { Guide } from '../types';

const sentinel = { id: 'from-another-store', title: 'elsewhere' } as Guide;

describe('a second store behind the service', () => {
  beforeEach(() => resetStore());

  it('serves shared reads from whatever store is configured', async () => {
    configureStore({ ...dexieStore, getGuides: async () => [sentinel] });
    expect(await getGuides()).toEqual([sentinel]);
  });

  it('serves shared writes from that store too', async () => {
    const written: string[] = [];
    configureStore({
      ...dexieStore,
      createGuide: async (id: string) => {
        written.push(id);
        return sentinel;
      },
    });
    await createGuide('abc');
    expect(written).toEqual(['abc']);
  });

  it('goes back to the browser store when reset', () => {
    const other = { ...dexieStore, getGuides: async () => [sentinel] };
    configureStore(other);
    expect(store.getGuides).toBe(other.getGuides);
    resetStore();
    expect(store.getGuides).toBe(dexieStore.getGuides);
  });
});
