import { localStorage } from '@/lib/browser-api/local-storage';
import { sendMessageToTab } from '@/lib/browser-api/send-message-to-tab';
import { TabMessage } from '@/lib/tab-messages';

const HIDE_TIMEOUT_MS = 150;

export async function withCardHidden<T>(tabId: number | undefined, run: () => Promise<T>): Promise<T> {
  const { recordingCard } = await localStorage.get(['recordingCard']);
  if (recordingCard !== true || tabId === undefined) return run();
  const hidden = await Promise.race([
    sendMessageToTab(tabId, { type: TabMessage.HIDE_CARD }).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), HIDE_TIMEOUT_MS)),
  ]);
  try {
    return await run();
  } finally {
    if (hidden) void sendMessageToTab(tabId, { type: TabMessage.SHOW_CARD }).catch(() => undefined);
  }
}
