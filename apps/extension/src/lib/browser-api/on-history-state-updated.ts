import { type Browser, browser } from '#imports';

export function onHistoryStateUpdated(
  handler: (details: Browser.webNavigation.WebNavigationTransitionCallbackDetails) => void,
): void {
  browser.webNavigation.onHistoryStateUpdated.addListener(handler);
}
