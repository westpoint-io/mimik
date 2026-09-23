import { browser } from '#imports';

export function sendMessageToTab(tabId: number, msg: Record<string, unknown>): Promise<unknown> {
  return browser.tabs.sendMessage(tabId, msg);
}
