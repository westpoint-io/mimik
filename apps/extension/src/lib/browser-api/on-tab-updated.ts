import { type Browser, browser } from '#imports';

export function onTabUpdated(
  handler: (tabId: number, changeInfo: Browser.tabs.OnUpdatedInfo, tab: Browser.tabs.Tab) => void,
): void {
  browser.tabs.onUpdated.addListener(handler);
}
