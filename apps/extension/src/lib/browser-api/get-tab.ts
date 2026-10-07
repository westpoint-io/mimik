import { type Browser, browser } from '#imports';

export function getTab(tabId: number): Promise<Browser.tabs.Tab> {
  return browser.tabs.get(tabId);
}
