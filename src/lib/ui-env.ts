import { configureUi } from '@mimik/ui/env';
import { getRecordableTabs } from '@/capture/recordable-tabs';
import { startInsertRecording } from '@/capture/start-insert-recording';
import { createTab } from '@/lib/browser-api/create-tab';
import { focusWindow } from '@/lib/browser-api/focus-window';
import { getActiveTab } from '@/lib/browser-api/get-active-tab';
import { getTab } from '@/lib/browser-api/get-tab';
import { openSidebar } from '@/lib/browser-api/open-sidebar';
import { queryTabs } from '@/lib/browser-api/query-tabs';
import { requestHostPermissions } from '@/lib/browser-api/request-host-permissions';
import { updateTab } from '@/lib/browser-api/update-tab';
import { sendMessage } from '@/lib/messaging';

configureUi({
  tabs: {
    active: () => getActiveTab() as never,
    get: (tabId) => getTab(tabId) as never,
    query: (query) => queryTabs(query as never) as never,
    create: (url) => createTab({ url }) as never,
    update: (tabId, props) => updateTab(tabId, props as never) as never,
    focusWindow: (windowId) => focusWindow(windowId) as never,
    recordable: () => getRecordableTabs() as never,
    startInsertRecording: (guideId, index, tabId) => startInsertRecording(guideId, index, tabId) as never,
  },
  panel: {
    open: () => openSidebar(),
    requestHostPermissions: () => requestHostPermissions(),
  },
  send: (name, payload) => sendMessage(name as never, payload as never) as never,
});
