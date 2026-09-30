import { i18n } from '@mimik/core/env';
import { ExternalLink, FileText, PanelLeftClose, PanelLeftOpen, Settings, Star, Trash2, Video } from 'lucide-react';
import { MascotIcon } from '../../common/components/MascotIcon';
import { useFullview } from '../../stores/use-fullview';
import { navigate } from '../lib/navigate';
import type { Route } from '../types';

interface SidebarProps {
  route: Route;
  collapsed: boolean;
  onToggle: () => void;
  onStartCapture?: () => void;
  onSettings?: () => void;
  settingsExternal?: boolean;
  version?: string;
}

const navItems = [
  { key: 'all' as const, labelKey: 'fullview_allGuides' as const, icon: FileText },
  { key: 'starred' as const, labelKey: 'fullview_starred' as const, icon: Star },
  { key: 'trash' as const, labelKey: 'fullview_trash' as const, icon: Trash2 },
];

export function Sidebar({
  route,
  collapsed,
  onToggle,
  onStartCapture,
  onSettings,
  settingsExternal,
  version,
}: SidebarProps) {
  const counts = useFullview((s) => s.counts);
  const row = collapsed ? 'justify-center w-9 mx-auto' : 'gap-2.5 px-2.5';
  const toggleLabel = i18n.t(collapsed ? 'fullview_expandSidebar' : 'fullview_collapseSidebar');
  const startLabel = i18n.t('sidepanel_startCapture');
  const settingsLabel = i18n.t('settings_title');

  return (
    <aside
      className={`sticky top-0 h-screen shrink-0 flex flex-col gap-1.5 py-[18px] bg-card border-r border-border ${collapsed ? 'w-16' : 'w-[232px] px-3.5'}`}
    >
      <div className={collapsed ? 'flex flex-col items-center gap-3.5 pb-3.5' : 'flex items-center gap-2 pl-2 pb-3.5'}>
        <button
          onClick={() => navigate({ page: 'library', category: 'all' })}
          className="flex items-center gap-2 cursor-pointer"
        >
          <span className="mb-1">
            <MascotIcon size={22} />
          </span>
          {!collapsed && (
            <span className="text-[15px] font-bold tracking-tight text-foreground">{i18n.t('app_name')}</span>
          )}
        </button>
        <button
          onClick={onToggle}
          aria-label={toggleLabel}
          title={toggleLabel}
          className={`${collapsed ? '' : 'ml-auto'} p-1 rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground`}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {onStartCapture && (
        <button
          onClick={onStartCapture}
          aria-label={startLabel}
          title={collapsed ? startLabel : undefined}
          className={`flex items-center justify-center gap-2 h-[38px] mb-3.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold transition-colors hover:bg-primary/90 ${collapsed ? 'w-[38px] mx-auto' : ''}`}
        >
          <Video size={15} />
          {!collapsed && startLabel}
        </button>
      )}

      {navItems.map((item) => {
        const active = route.page === 'library' ? route.category === item.key : item.key === 'all';
        const label = i18n.t(item.labelKey);
        const count = counts[item.key];
        return (
          <button
            key={item.key}
            onClick={() => navigate({ page: 'library', category: item.key })}
            aria-label={label}
            title={collapsed ? label : undefined}
            className={`flex items-center h-9 rounded-lg text-[13px] text-foreground transition-colors ${row} ${active ? 'bg-secondary font-semibold' : 'font-medium hover:bg-secondary/60'}`}
          >
            <item.icon size={15} className="shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left truncate">{label}</span>
                {count > 0 && <span className="text-[11px] font-medium text-muted-foreground">{count}</span>}
              </>
            )}
          </button>
        );
      })}

      {onSettings && (
        <button
          onClick={onSettings}
          aria-label={settingsLabel}
          title={collapsed ? settingsLabel : undefined}
          className={`mt-auto flex items-center h-9 rounded-lg text-[13px] font-medium text-foreground transition-colors hover:bg-secondary/60 ${row}`}
        >
          <Settings size={15} className="shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{settingsLabel}</span>
              {version && <span className="text-[11px] font-medium text-muted-foreground">{version}</span>}
              {settingsExternal && <ExternalLink size={12} className="text-muted-foreground" />}
            </>
          )}
        </button>
      )}
    </aside>
  );
}
