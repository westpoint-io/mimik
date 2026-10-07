import { createTab } from '@/lib/browser-api/create-tab';
import { focusWindow } from '@/lib/browser-api/focus-window';
import { getExtensionURL } from '@/lib/browser-api/get-extension-url';
import { queryTabs } from '@/lib/browser-api/query-tabs';
import { updateTab } from '@/lib/browser-api/update-tab';

export async function openDashboard() {
  const url = getExtensionURL('/fullview.html');
  const tabs = await queryTabs({ url });
  const existing = tabs[0];
  if (existing?.id) {
    await updateTab(existing.id, { active: true });
    if (existing.windowId) await focusWindow(existing.windowId);
  } else {
    await createTab({ url });
  }
}
