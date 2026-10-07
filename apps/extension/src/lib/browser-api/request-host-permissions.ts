import { browser } from '#imports';

export function requestHostPermissions(): Promise<boolean> {
  if (import.meta.env.BROWSER !== 'firefox') return Promise.resolve(true);
  try {
    return browser.permissions.request({ origins: ['<all_urls>'] }).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}
