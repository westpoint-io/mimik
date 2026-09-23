import { type Browser, browser } from '#imports';

export function onTabActivated(handler: (activeInfo: Browser.tabs.OnActivatedInfo) => void): void {
  browser.tabs.onActivated.addListener(handler);
}
