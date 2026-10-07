import { browser } from '#imports';
import { UPDATE_NOTICE_KEY } from './constants';

export async function recordUpdate(reason: string): Promise<void> {
  if (reason !== 'update') return;
  await browser.storage.local.set({ [UPDATE_NOTICE_KEY]: browser.runtime.getManifest().version });
}
