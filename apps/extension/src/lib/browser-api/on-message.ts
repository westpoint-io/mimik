import { type Browser, browser } from '#imports';

export function onMessage(
  handler: (
    msg: unknown,
    sender: Browser.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => boolean | undefined,
): void {
  browser.runtime.onMessage.addListener(handler);
}
