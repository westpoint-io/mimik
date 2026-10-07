import { type Browser, browser } from '#imports';

export function onNavigationCompleted(
  handler: (details: Browser.webNavigation.WebNavigationFramedCallbackDetails) => void,
): void {
  browser.webNavigation.onCompleted.addListener(handler);
}
