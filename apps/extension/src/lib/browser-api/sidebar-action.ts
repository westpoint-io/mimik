import { browser } from '#imports';

export const sidebarAction = () =>
  (browser as unknown as { sidebarAction: { open(): Promise<void> | undefined; toggle(): void } }).sidebarAction;
