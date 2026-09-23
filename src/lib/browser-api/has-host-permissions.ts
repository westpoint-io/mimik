import { browser } from '#imports';

export async function hasHostPermissions(): Promise<boolean> {
  if (import.meta.env.BROWSER !== 'firefox') return true;
  try {
    return await browser.permissions.contains({ origins: ['<all_urls>'] });
  } catch {
    return false;
  }
}
