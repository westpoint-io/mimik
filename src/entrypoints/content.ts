import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from '#imports';
import '@/lib/i18n-runtime';
import { BlurManager } from '@/core/blur/manager';
import { CaptureSession } from '@/core/capture/session';
import { updateUrl } from '@/core/capture/spa-nav';
import { showStartNotification } from '@/core/capture/start-notification';
import { GuideMeController } from '@/core/guideme/content';
import { logger } from '@/lib/logger';
import { TabMessage } from '@/lib/tab-messages';

const CLEANUP_EVENT = `mimik_cleanup_${browser.runtime.id}`;

function createTabMessageHandler(session: CaptureSession, guideMe: GuideMeController, blurManager: BlurManager) {
  return function handleTabMessage(msg: Record<string, unknown>, _sender: unknown, sendResponse: (r: unknown) => void) {
    if (session.isDisabled) return false;

    switch (msg.type) {
      case TabMessage.PING:
        sendResponse({ alive: true });
        return true;

      case TabMessage.GET_ROUTE:
        sendResponse({ alive: true, capturing: session.isActive });
        return true;

      case TabMessage.START_CAPTURE:
        if (msg.guideId) {
          session.start(msg.guideId as string);
          sendResponse({ started: true });
        }
        return true;

      case TabMessage.STOP_CAPTURE:
        session.stop();
        sendResponse({ stopped: true });
        return true;

      case TabMessage.URL_CHANGED:
        if (msg.url) {
          updateUrl(msg.url as string);
          sendResponse({ updated: true });
        }
        return true;

      case TabMessage.SHOW_NOTIFICATION:
        logger.debug('Received SHOW_NOTIFICATION message');
        showStartNotification().then(() => {
          sendResponse({ done: true });
        });
        return true;

      case TabMessage.GUIDEME_STOP:
        guideMe.dispose();
        sendResponse({ stopped: true });
        return true;

      case TabMessage.START_BLUR:
        if (window.self === window.top) blurManager.start();
        sendResponse({ started: true });
        return true;

      default:
        return false;
    }
  };
}

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  runAt: 'document_idle',

  main() {
    document.dispatchEvent(new CustomEvent(CLEANUP_EVENT));

    const session = new CaptureSession();
    const guideMe = new GuideMeController();
    const blurManager = new BlurManager();
    const handleTabMessage = createTabMessageHandler(session, guideMe, blurManager);

    document.addEventListener(CLEANUP_EVENT, () => {
      session.dispose();
      guideMe.dispose();
      browser.runtime.onMessage.removeListener(handleTabMessage);
      blurManager.stop();
    });

    window.addEventListener('beforeunload', () => session.stop());
    browser.runtime.onMessage.addListener(handleTabMessage);

    logger.info('Content script loaded →', window.location.href);
  },
});
