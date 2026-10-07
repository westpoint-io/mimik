import { type Browser, browser } from '#imports';

export function createTab(options: Browser.tabs.CreateProperties): Promise<Browser.tabs.Tab> {
  return browser.tabs.create(options);
}
