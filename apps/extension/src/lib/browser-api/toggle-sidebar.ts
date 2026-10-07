import { sidebarAction } from './sidebar-action';

export function toggleSidebar(): void {
  if (import.meta.env.BROWSER === 'firefox') {
    sidebarAction().toggle();
  }
}
