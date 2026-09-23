import { browser } from '#imports';
import { sidebarAction } from './sidebar-action';

export function openSidebar(): void {
  try {
    if (import.meta.env.BROWSER === 'firefox') {
      sidebarAction()
        .open()
        ?.catch(() => undefined);
    } else {
      browser.sidePanel.open({ windowId: browser.windows.WINDOW_ID_CURRENT })?.catch(() => undefined);
    }
  } catch {
    return;
  }
}
