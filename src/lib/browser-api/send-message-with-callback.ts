import { browser } from '#imports';

export function sendMessageWithCallback(msg: Record<string, unknown>, callback: (response: unknown) => void): void {
  browser.runtime.sendMessage(msg, callback);
}
