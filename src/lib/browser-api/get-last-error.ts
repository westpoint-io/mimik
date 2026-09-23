import { type Browser, browser } from '#imports';

export function getLastError(): Browser.runtime.LastError | undefined {
  return browser.runtime.lastError;
}
