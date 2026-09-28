import type { ReactNode } from 'react';
import { useSidebarCollapse } from '../hooks/use-sidebar-collapse';
import type { Route } from '../types';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface AppFrameProps {
  route: Route;
  onStartCapture?: () => void;
  onSettings?: () => void;
  settingsExternal?: boolean;
  guideActions?: ReactNode;
  children: ReactNode;
}

export function AppFrame({
  route,
  onStartCapture,
  onSettings,
  settingsExternal,
  guideActions,
  children,
}: AppFrameProps) {
  const { collapsed, toggle } = useSidebarCollapse();
  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar
        route={route}
        collapsed={collapsed}
        onToggle={toggle}
        onStartCapture={onStartCapture}
        onSettings={onSettings}
        settingsExternal={settingsExternal}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar route={route} guideActions={guideActions} />
        {children}
      </div>
    </div>
  );
}
