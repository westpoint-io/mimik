import { logger } from '@mimik/core/logger';
import { isRecordableUrl } from '@/capture/recordable-tabs';
import { executeScript } from '@/lib/browser-api/execute-script';
import { queryTabs } from '@/lib/browser-api/query-tabs';
import { sendMessageToTab } from '@/lib/browser-api/send-message-to-tab';
import { TabMessage, type TabMessageType } from '@/lib/tab-messages';

export function isInjectableTab(tab: { url?: string; pendingUrl?: string }): boolean {
  return isRecordableUrl(tab.url || tab.pendingUrl);
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

export async function broadcastAttachCapture(guideId: string): Promise<void> {
  try {
    const tabs = await queryTabs({});
    for (const tab of tabs) {
      if (tab.id && isInjectableTab(tab)) {
        sendMessageToTab(tab.id, { type: TabMessage.ATTACH_CAPTURE, guideId }).catch(() => {});
      }
    }
  } catch (err) {
    logger.warn(' broadcastAttachCapture failed', err);
  }
}

export async function broadcastDismissBlur(): Promise<void> {
  await broadcastBlur(TabMessage.DISMISS_BLUR);
}

export async function broadcastClearBlur(): Promise<void> {
  await broadcastBlur(TabMessage.CLEAR_BLUR);
}

async function broadcastBlur(type: TabMessageType): Promise<void> {
  try {
    const tabs = await queryTabs({});
    for (const tab of tabs) {
      if (tab.id) {
        sendMessageToTab(tab.id, { type }).catch(() => {});
      }
    }
  } catch (err) {
    logger.warn(' broadcastBlur failed', type, err);
  }
}

const FLUSH_TIMEOUT_MS = 1500;

export async function broadcastDetachCaptureAndFlush(): Promise<void> {
  try {
    const tabs = await queryTabs({});
    const sends = tabs
      .filter((tab): tab is typeof tab & { id: number } => tab.id !== undefined)
      .map((tab) => sendMessageToTab(tab.id, { type: TabMessage.DETACH_CAPTURE }).catch(() => {}));
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS));
    await Promise.race([Promise.allSettled(sends), timeout]);
  } catch (err) {
    logger.warn(' broadcastDetachCaptureAndFlush failed', err);
  }
}

export async function broadcastDetachCapture(): Promise<void> {
  try {
    const tabs = await queryTabs({});
    for (const tab of tabs) {
      if (tab.id) {
        sendMessageToTab(tab.id, { type: TabMessage.DETACH_CAPTURE }).catch(() => {});
      }
    }
  } catch (err) {
    logger.warn(' broadcastDetachCapture failed', err);
  }
}
