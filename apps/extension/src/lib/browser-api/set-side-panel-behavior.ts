import { browser } from '#imports';

export function setSidePanelBehavior(openOnActionClick: boolean): void {
  if (import.meta.env.BROWSER === 'firefox') return;
  browser.sidePanel.setPanelBehavior({
    openPanelOnActionClick: openOnActionClick,
  });
}
