import { executeScript, queryTabs, sendMessageToTab } from '@/lib/browser-api';
import { logger } from '@/lib/logger';
import { TabMessage, type TabMessageType } from '@/lib/tab-messages';

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

/**
 * Closes the blur overlay everywhere, leaving the masks in place. Broadcast
 * rather than aimed at the active tab, because a paused recording re-opens the
 * overlay on whatever page loads, so the overlay may live in a different tab
 * by the time capture resumes.
 */
export async function broadcastDismissBlur(): Promise<void> {
  await broadcastBlur(TabMessage.DISMISS_BLUR);
}

/** Closes the overlay and removes the masks. For the end of a recording. */
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

/** A frame that never answers must not hold a pause open. */
const FLUSH_TIMEOUT_MS = 1500;

/**
 * Stops capture everywhere and waits for the content scripts to answer, which
 * they only do once their queue has drained. Pausing mid-typing would otherwise
 * drop the finalize that writes the step's real screenshot.
 */
export async function broadcastStopCaptureAndFlush(): Promise<void> {
  try {
    const tabs = await queryTabs({});
    const sends = tabs
      .filter((tab): tab is typeof tab & { id: number } => tab.id !== undefined)
      .map((tab) => sendMessageToTab(tab.id, { type: TabMessage.STOP_CAPTURE }).catch(() => {}));
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS));
    await Promise.race([Promise.allSettled(sends), timeout]);
  } catch (err) {
    logger.warn(' broadcastStopCaptureAndFlush failed', err);
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
