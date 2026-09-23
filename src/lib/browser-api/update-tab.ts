import { type Browser, browser } from '#imports';

export function updateTab(tabId: number, props: Browser.tabs.UpdateProperties): Promise<Browser.tabs.Tab | undefined> {
  return browser.tabs.update(tabId, props);
}
