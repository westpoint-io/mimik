import { browser } from '#imports';

export function getExtensionId(): string {
  return browser.runtime.id;
}
