import { type CaptureSnapshot, CaptureState } from '@/core/capture/machine';
import {
  getTab,
  onHistoryStateUpdated,
  onNavigationCompleted,
  onTabActivated,
  onTabUpdated,
  sendMessageToTab,
} from '@/lib/browser-api';
import { logger } from '@/lib/logger';
import { TabMessage } from '@/lib/tab-messages';
import { getActor, waitUntilReady } from './actor';
import { injectContentScript, isInjectableTab } from './tab-manager';

/**
 * A paused recording is still a recording: the tab keeps navigating, and the URL
 * has to stay current or the next step after the resume is stamped with the page
 * the user was on before pausing — which then drives Guide Me's replay to the
 * wrong page. Content scripts need injecting while paused for the same reason:
 * a tab opened mid-pause would otherwise be deaf to the resume broadcast.
 */
function isLive(state: CaptureSnapshot): boolean {
  return state.value === CaptureState.RECORDING || state.value === CaptureState.PAUSED;
}

export function registerNavigationListeners() {
  onNavigationCompleted(async (details) => {
    if (details.frameId !== 0) return;
    await waitUntilReady();
    const state = getActor().getSnapshot();
    if (isLive(state)) {
      logger.debug('URL changed (navigation) →', details.url);
      getActor().send({ type: 'URL_CHANGED', url: details.url });
    }
  });

  onHistoryStateUpdated(async (details) => {
    if (details.frameId !== 0) return;
    await waitUntilReady();
    const state = getActor().getSnapshot();
    if (isLive(state)) {
      logger.debug('URL changed (SPA pushState) →', details.url);
      getActor().send({ type: 'URL_CHANGED', url: details.url });
    }
  });

  onTabActivated(async (activeInfo) => {
    await waitUntilReady();
    const state = getActor().getSnapshot();
    if (!isLive(state)) return;
    if (!state.context.currentGuideId) return;

    try {
      await sendMessageToTab(activeInfo.tabId, { type: TabMessage.PING });
      logger.debug('Tab switched → content script alive on tab', activeInfo.tabId);
    } catch {
      logger.debug('Tab switched → injecting content script on tab', activeInfo.tabId);
      try {
        const tab = await getTab(activeInfo.tabId);
        if (isInjectableTab(tab)) {
          await injectContentScript(activeInfo.tabId);
        }
      } catch {}
    }
  });

  onTabUpdated(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    await waitUntilReady();
    const state = getActor().getSnapshot();
    if (!isLive(state)) return;
    if (!isInjectableTab(tab)) return;

    try {
      await sendMessageToTab(tabId, { type: TabMessage.PING });
    } catch {
      logger.debug('Tab loaded → injecting content script on tab', tabId);
      try {
        await injectContentScript(tabId);
      } catch {}
    }
  });
}
