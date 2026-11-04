import '@/lib/core-env';
import '@/lib/ui-env';
import { isLive } from '@mimik/core/capture/is-live';
import { logger } from '@mimik/core/logger';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from '#imports';
import { BlurManager } from '@/blur/manager';
import { shouldReopenBlur } from '@/blur/restore';
import { CaptureSession } from '@/capture/session';
import { showStartNotification } from '@/core/capture/start-notification';
import { GuideMeController } from '@/guideme/content';
import { localStorage } from '@/lib/browser-api/local-storage';
import { sendMessage } from '@/lib/messaging';
import { TabMessage } from '@/lib/tab-messages';
import { CardFrame } from '@/page-ui/card-frame';

const CLEANUP_EVENT = `mimik_cleanup_${browser.runtime.id}`;
const HIDE_CARD_WAIT_MS = 80;

async function showCardWhileLive(card: CardFrame | null): Promise<void> {
  if (!card || card.mounted) return;
  const { recordingCard } = await localStorage.get(['recordingCard']);
  if (recordingCard !== true) return;
  const current = await sendMessage('getState', undefined).catch(() => null);
  if (current && isLive(current.state)) card.mount();
}

function createTabMessageHandler(
  session: CaptureSession,
  guideMe: GuideMeController,
  blurManager: BlurManager,
  card: CardFrame | null,
) {
  return function handleTabMessage(msg: Record<string, unknown>, _sender: unknown, sendResponse: (r: unknown) => void) {
    if (session.isDisabled) return false;

    switch (msg.type) {
      case TabMessage.PING:
        sendResponse({ alive: true });
        return true;

      case TabMessage.GET_ROUTE:
        sendResponse({ alive: true, capturing: session.isActive });
        return true;

      case TabMessage.ATTACH_CAPTURE:
        if (msg.guideId) {
          session.start(msg.guideId as string);
          void showCardWhileLive(card);
          sendResponse({ started: true });
        }
        return true;

      case TabMessage.DETACH_CAPTURE:
        session.stop().then(() => sendResponse({ stopped: true }));
        return true;

      case TabMessage.URL_CHANGED:
        if (msg.url) sendResponse({ updated: true });
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

      case TabMessage.CAPTURE_NOW:
        if (window.self !== window.top) return false;
        session.captureNow();
        sendResponse({ queued: session.isActive });
        return true;

      case TabMessage.START_BLUR:
        if (window.self === window.top) blurManager.start();
        sendResponse({ started: true });
        return true;

      case TabMessage.DISMISS_BLUR:
        blurManager.dismiss();
        sendResponse({ dismissed: true });
        return true;

      case TabMessage.CLEAR_BLUR:
        blurManager.stop();
        sendResponse({ stopped: true });
        return true;

      case TabMessage.HIDE_CARD: {
        if (!card?.mounted) return false;
        card.setHidden(true);
        let replied = false;
        const reply = () => {
          if (replied) return;
          replied = true;
          sendResponse({ hidden: true });
        };
        requestAnimationFrame(() => requestAnimationFrame(reply));
        setTimeout(reply, HIDE_CARD_WAIT_MS);
        return true;
      }

      case TabMessage.SHOW_CARD:
        card?.setHidden(false);
        return false;

      case TabMessage.TOGGLE_CARD:
        if (!card) return false;
        if (card.mounted) card.unmount();
        else card.mount();
        sendResponse({ shown: card.mounted });
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

    const blurManager = new BlurManager();
    const session = new CaptureSession(async (state) => {
      if (!shouldReopenBlur(state, window.self === window.top)) return;
      const current = await sendMessage('getState', undefined).catch(() => null);
      if (!current || !shouldReopenBlur(current, true)) return;
      blurManager.start();
    });
    const guideMe = new GuideMeController();
    const card = window.self === window.top ? new CardFrame() : null;
    const handleTabMessage = createTabMessageHandler(session, guideMe, blurManager, card);
    void showCardWhileLive(card);

    document.addEventListener(CLEANUP_EVENT, () => {
      session.dispose();
      guideMe.dispose();
      browser.runtime.onMessage.removeListener(handleTabMessage);
      blurManager.stop();
      card?.unmount();
    });

    window.addEventListener('beforeunload', () => session.stop());
    browser.runtime.onMessage.addListener(handleTabMessage);

    logger.info('Content script loaded →', window.location.href);
  },
});
