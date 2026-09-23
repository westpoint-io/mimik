import { browser } from '#imports';
import { UPDATE_NOTICE_KEY } from './constants';

export function dismissUpdateNotice(): Promise<void> {
  return browser.storage.local.remove(UPDATE_NOTICE_KEY);
}
