import { type Browser, browser } from '#imports';

export function queryTabs(query: Browser.tabs.QueryInfo): Promise<Browser.tabs.Tab[]> {
  return browser.tabs.query(query);
}
