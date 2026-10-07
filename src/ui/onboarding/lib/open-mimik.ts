import { browser } from '#imports';
import { openSidebar } from '@/lib/browser-api/open-sidebar';
import { requestHostPermissions } from '@/lib/browser-api/request-host-permissions';

export async function openMimik() {
  openSidebar();
  await requestHostPermissions();
  await browser.tabs.create({ url: browser.runtime.getURL('/fullview.html') });
}
