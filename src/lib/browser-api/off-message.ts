import { browser } from '#imports';

export function offMessage(handler: (...args: unknown[]) => unknown): void {
  browser.runtime.onMessage.removeListener(handler);
}
