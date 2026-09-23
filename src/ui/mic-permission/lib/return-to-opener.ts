import { browser } from '#imports';

function openerTabId(): number | null {
  const raw = new URLSearchParams(window.location.search).get('tabId');
  const id = raw === null ? Number.NaN : Number(raw);
  return Number.isInteger(id) && id >= 0 ? id : null;
}

export async function returnToOpener(): Promise<void> {
  const tabId = openerTabId();
  if (tabId !== null) await browser.tabs.update(tabId, { active: true }).catch(() => undefined);
  const self = await browser.tabs.getCurrent().catch(() => undefined);
  if (self?.id !== undefined) await browser.tabs.remove(self.id).catch(() => undefined);
  else window.close();
}
