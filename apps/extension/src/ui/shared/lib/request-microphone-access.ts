import { getActiveTab } from '@/lib/browser-api/get-active-tab';
import { openMicPermissionPage } from '@/lib/offscreen/open-mic-permission-page';

export async function requestMicrophoneAccess() {
  const tab = await getActiveTab().catch(() => undefined);
  await openMicPermissionPage(tab?.id);
}
