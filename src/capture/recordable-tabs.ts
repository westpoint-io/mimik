import { queryTabs } from '@/lib/browser-api/query-tabs';

const WEBSTORE_PREFIXES = ['https://chrome.google.com/webstore', 'https://chromewebstore.google.com'];

export interface RecordableTab {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
}

export function isRecordableUrl(url: string | undefined): boolean {
  if (!url || WEBSTORE_PREFIXES.some((prefix) => url.startsWith(prefix))) return false;
  return /^https?:/.test(url);
}

export async function getRecordableTabs(): Promise<RecordableTab[]> {
  const tabs = await queryTabs({ currentWindow: true });
  return tabs
    .filter((tab) => tab.id !== undefined && isRecordableUrl(tab.url || tab.pendingUrl))
    .map((tab) => ({
      id: tab.id as number,
      title: tab.title || ((tab.url || tab.pendingUrl) as string),
      url: (tab.url || tab.pendingUrl) as string,
      favIconUrl: tab.favIconUrl,
    }));
}
