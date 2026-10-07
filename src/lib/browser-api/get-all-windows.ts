import { type Browser, browser } from '#imports';

export function getAllWindows(): Promise<Browser.windows.Window[]> {
  return browser.windows.getAll({ populate: true });
}
