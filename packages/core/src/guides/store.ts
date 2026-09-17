import { dexieStore } from './dexie-store';

export type GuideStore = typeof dexieStore;

let current: GuideStore = dexieStore;

export function configureStore(store: GuideStore): void {
  current = store;
}

export function resetStore(): void {
  current = dexieStore;
}

export const store: GuideStore = new Proxy({} as GuideStore, {
  get: (_target, key: string) => current[key as keyof GuideStore],
});
