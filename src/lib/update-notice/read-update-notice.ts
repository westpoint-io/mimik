import { browser } from '#imports';
import { UPDATE_NOTICE_KEY } from './constants';

export async function readUpdateNotice(): Promise<string | undefined> {
  const data = await browser.storage.local.get([UPDATE_NOTICE_KEY]);
  return data?.[UPDATE_NOTICE_KEY] as string | undefined;
}
