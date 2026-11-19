import { browser } from '#imports';

export function closeSidebar(): void {
  if (import.meta.env.BROWSER !== 'firefox') {
    window.close();
    return;
  }
  const action = (browser as unknown as { sidebarAction?: { close(): Promise<void> } }).sidebarAction;
  void action?.close().catch(() => undefined);
}
