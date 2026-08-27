import { browser } from '#imports';

export const UPDATE_NOTICE_KEY = 'updateNotice';

export async function recordUpdate(reason: string): Promise<void> {
  if (reason !== 'update') return;
  await browser.storage.local.set({ [UPDATE_NOTICE_KEY]: browser.runtime.getManifest().version });
}

export async function readUpdateNotice(): Promise<string | undefined> {
  const data = await browser.storage.local.get([UPDATE_NOTICE_KEY]);
  return data?.[UPDATE_NOTICE_KEY] as string | undefined;
}

export function dismissUpdateNotice(): Promise<void> {
  return browser.storage.local.remove(UPDATE_NOTICE_KEY);
}
