import { browser } from '#imports';

export const sessionStorage = {
  get: (key: string) => browser.storage.session.get(key),
  set: (items: Record<string, unknown>) => browser.storage.session.set(items),
  remove: (key: string) => browser.storage.session.remove(key),
};
