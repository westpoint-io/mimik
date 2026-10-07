import { configureUi } from '@mimik/ui/env';
import { getRecordableTabs } from '@/capture/recordable-tabs';
import { startInsertRecording } from '@/capture/start-insert-recording';
import { createTab } from '@/lib/browser-api/create-tab';
import { openSidebar } from '@/lib/browser-api/open-sidebar';
import { sendMessage } from '@/lib/messaging';

configureUi({
  tabs: {
    create: (url) => createTab({ url }) as never,
    recordable: () => getRecordableTabs() as never,
    startInsertRecording: (guideId, index, tabId) => startInsertRecording(guideId, index, tabId) as never,
  },
  panel: {
    open: () => openSidebar(),
  },
  send: (name, payload) => sendMessage(name as never, payload as never) as never,
});
