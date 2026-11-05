import { browser } from '#imports';
import { isRecordableUrl } from '@/capture/recordable-tabs';
import { localStorage } from '@/lib/browser-api/local-storage';

export async function syncCardPopup(tab: { id?: number; url?: string; pendingUrl?: string }): Promise<void> {
  if (tab.id === undefined) return;
  const { recordingCard } = await localStorage.get(['recordingCard']);
  const url = tab.url || tab.pendingUrl || '';
  const locked = !isRecordableUrl(url) && !url.startsWith(browser.runtime.getURL('/'));
  const blocked = recordingCard === true && locked;
  await (browser.action ?? browser.browserAction).setPopup({
    tabId: tab.id,
    popup: blocked ? '/recording-card.html?popup' : '',
  });
}
