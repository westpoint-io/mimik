import { browser } from '#imports';

export function captureVisibleTab(format: 'jpeg' | 'png' = 'jpeg', quality = 90): Promise<string> {
  return browser.tabs.captureVisibleTab({ format, quality });
}
