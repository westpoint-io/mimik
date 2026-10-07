import { logger } from '@mimik/core/logger';
import { focusWindow } from '@/lib/browser-api/focus-window';
import { getTab } from '@/lib/browser-api/get-tab';
import { requestHostPermissions } from '@/lib/browser-api/request-host-permissions';
import { updateTab } from '@/lib/browser-api/update-tab';
import { sendMessage } from '@/lib/messaging';
import { isRecordableUrl } from './recordable-tabs';

export async function startInsertRecording(
  guideId: string,
  insertAtIndex: number,
  tabId: number,
): Promise<string | null> {
  if (!(await requestHostPermissions())) {
    logger.warn('Host permissions not granted, cannot start recording');
    return null;
  }

  const tab = await getTab(tabId).catch(() => null);
  if (!isRecordableUrl(tab?.url || tab?.pendingUrl)) {
    logger.warn('Selected tab can no longer be recorded');
    return null;
  }

  await updateTab(tabId, { active: true });
  if (tab?.windowId) await focusWindow(tab.windowId);

  try {
    const res = await sendMessage('startRecording', {
      url: tab?.url || '',
      insertTargetGuideId: guideId,
      insertAtIndex,
    });
    return res.guideId ?? null;
  } catch (err) {
    logger.error(' START_RECORDING error', err);
    return null;
  }
}
