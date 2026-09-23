import { logger } from '@mimik/core/logger';
import { executeScript } from '@/lib/browser-api/execute-script';
import { queryTabs } from '@/lib/browser-api/query-tabs';
import { sendMessageToTab } from '@/lib/browser-api/send-message-to-tab';
import { TabMessage } from '@/lib/tab-messages';

export function isInjectableTab(tab: { url?: string; pendingUrl?: string }): boolean {
  const url = tab.url || tab.pendingUrl || '';
  if (
    !url ||
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('chrome.google.com/webstore') ||
    url.startsWith('about:')
  )
    return false;
  return /^https?:/.test(url);
}

export async function injectContentScript(tabId: number): Promise<void> {
  try {
    await sendMessageToTab(tabId, { type: TabMessage.PING });
  } catch {
    try {
      await executeScript(tabId, ['/content-scripts/content.js']);
    } catch {}
  }
}

export async function showNotificationOnTab(tabId: number): Promise<void> {
  try {
    await sendMessageToTab(tabId, { type: TabMessage.SHOW_NOTIFICATION });
  } catch (err) {
    logger.warn('showNotificationOnTab failed', err);
  }
}

export async function broadcastStartCapture(guideId: string): Promise<void> {
  try {
    const tabs = await queryTabs({});
    for (const tab of tabs) {
      if (tab.id && isInjectableTab(tab)) {
        sendMessageToTab(tab.id, { type: TabMessage.START_CAPTURE, guideId }).catch(() => {});
      }
    }
  } catch (err) {
    logger.warn(' broadcastStartCapture failed', err);
  }
}

export async function broadcastStopCapture(): Promise<void> {
  try {
    const tabs = await queryTabs({});
    for (const tab of tabs) {
      if (tab.id) {
        sendMessageToTab(tab.id, { type: TabMessage.STOP_CAPTURE }).catch(() => {});
      }
    }
  } catch (err) {
    logger.warn(' broadcastStopCapture failed', err);
  }
}
