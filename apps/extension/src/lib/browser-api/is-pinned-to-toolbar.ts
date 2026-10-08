import { browser } from '#imports';

interface ToolbarAction {
  getUserSettings?: () => Promise<{ isOnToolbar?: boolean }>;
}

export async function isPinnedToToolbar(): Promise<boolean | null> {
  const action = browser.action as unknown as ToolbarAction | undefined;
  if (!action?.getUserSettings) return null;
  const settings = await action.getUserSettings().catch(() => null);
  return typeof settings?.isOnToolbar === 'boolean' ? settings.isOnToolbar : null;
}
