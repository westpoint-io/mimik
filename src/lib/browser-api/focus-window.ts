import { type Browser, browser } from '#imports';

export function focusWindow(windowId: number): Promise<Browser.windows.Window> {
  return browser.windows.update(windowId, { focused: true });
}
