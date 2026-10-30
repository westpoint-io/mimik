import { createTab } from '@/lib/browser-api/create-tab';
import { focusWindow } from '@/lib/browser-api/focus-window';
import { getExtensionURL } from '@/lib/browser-api/get-extension-url';
import { queryTabs } from '@/lib/browser-api/query-tabs';
import { updateTab } from '@/lib/browser-api/update-tab';

export async function openGuideInFullview(guideId: string): Promise<void> {
  const url = getExtensionURL(`/fullview.html?guideId=${guideId}`);
  const [tab] = await queryTabs({ url: getExtensionURL('/fullview.html') });
  if (tab?.id) {
    await updateTab(tab.id, { active: true, url });
    if (tab.windowId) await focusWindow(tab.windowId);
  } else {
    await createTab({ url });
  }
}
