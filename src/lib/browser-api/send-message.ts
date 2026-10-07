import { browser } from '#imports';

export function sendMessage(msg: Record<string, unknown>): Promise<unknown> {
  return browser.runtime.sendMessage(msg);
}
