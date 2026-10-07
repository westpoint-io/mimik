import { browser } from '#imports';
import type { Settings, SettingsKey } from '@/core/guides/types';

export const localStorage = {
  get: <K extends SettingsKey>(keys: readonly K[]) =>
    browser.storage.local.get(keys as unknown as K) as Promise<Partial<Pick<Settings, K>>>,
  set: (items: Partial<Settings>) => browser.storage.local.set(items),
};
