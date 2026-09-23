import { i18n } from '@mimik/core/env';
import { createSnapshot } from '@mimik/core/guides/service';
import { logger } from '@mimik/core/logger';
import MascotIcon from '@mimik/ui/common/components/MascotIcon';
import { Button } from '@mimik/ui/components/ui/button';
import type { Route } from '@mimik/ui/navigation/lib/router';
import { navigate } from '@mimik/ui/navigation/lib/router';
import { useFullview } from '@mimik/ui/stores/fullview';
import {
  Check,
  ChevronRight,
  Download,
  FileText,
  History,
  Pencil,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import ExportPreviewModal from '../../export/components/ExportPreviewModal';

interface TopNavProps {
  route: Route;
  onSettings?: () => void;
  onNavigate?: () => void;
  guideActions?: ReactNode;
}

const navItems = [
  { key: 'all' as const, labelKey: 'fullview_allGuides' as const, icon: FileText },
  { key: 'starred' as const, labelKey: 'fullview_starred' as const, icon: Star },
  { key: 'trash' as const, labelKey: 'fullview_trash' as const, icon: Trash2 },
];

const NAV_CONTROL = 'h-8 rounded-lg border border-border bg-card text-foreground hover:bg-secondary hover:text-accent';

export default function TopNav({ route, onSettings, onNavigate, guideActions }: TopNavProps) {
  const {
    counts,
    guideTitle,
    guideStepCount,
    guideExportData: exportData,
    setSearchOpen,
    editing,
    setEditing,
    historyOpen,
    setHistoryOpen,
    bumpHistoryRefresh,
  } = useFullview((s) => ({
    counts: s.counts,
    guideTitle: s.guideTitle,
    guideStepCount: s.guideStepCount,
    guideExportData: s.guideExportData,
    setSearchOpen: s.setSearchOpen,
    editing: s.editing,
    setEditing: s.setEditing,
    historyOpen: s.historyOpen,
    setHistoryOpen: s.setHistoryOpen,
    bumpHistoryRefresh: s.bumpHistoryRefresh,
  }));
  const [exportOpen, setExportOpen] = useState(false);

  const toggleEditing = (guideId: string) => {
    if (editing) {
      setEditing(false);
      return;
    }
    setEditing(true);
    createSnapshot(guideId)
      .then((snapshot) => {
        if (snapshot) bumpHistoryRefresh();
      })
      .catch((err) => logger.error(' Snapshot before editing failed', err));
  };

  return (
    <header className="flex items-center gap-5 px-7 h-16 shrink-0 bg-card border-b border-border">
      {/* Brand */}
      <button
        onClick={() => {
          onNavigate?.();
          navigate({ page: 'library', category: 'all' });
        }}
        className="flex items-center gap-2 mr-4 cursor-pointer h-full"
      >
        <div className="mb-1">
          <MascotIcon size={22} />
        </div>
        <span className="text-[15px] font-bold tracking-tight text-foreground">{i18n.t('app_name')}</span>
      </button>

      {route.page === 'guide'
        ? guideTitle && (
            <>
              <ChevronRight size={14} className="text-foreground opacity-25" />
              {guideTitle === i18n.t('fullview_untitledGuide') && guideStepCount > 0 ? (
                <span className="flex items-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-[5px] h-[5px] rounded-full bg-foreground animate-bounce"
                      style={{ animationDelay: `${i * 150}ms`, animationDuration: '1.2s' }}
                    />
                  ))}
                </span>
              ) : (
                <span className="text-[13px] font-medium truncate max-w-sm text-foreground">{guideTitle}</span>
              )}
            </>
          )
        : navItems.map((item) => {
            const active = route.page === 'library' && route.category === item.key;
            const count = counts[item.key];
            return (
              <button
                key={item.key}
                onClick={() => {
                  onNavigate?.();
                  navigate({ page: 'library', category: item.key });
                }}
                className={`flex items-center gap-1.5 text-[13px] h-8 px-3 rounded-md transition-all
                ${active ? 'bg-primary text-primary-foreground font-semibold' : 'text-foreground font-medium hover:bg-secondary'}`}
              >
                <item.icon size={13.5} />
                {i18n.t(item.labelKey)}
                {count > 0 && (
                  <span
                    className={`text-[11px] ml-0.5 ${active ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSearchOpen(true)}
          className={`w-52 justify-start ${NAV_CONTROL}`}
        >
          <Search size={14} className="shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left text-muted-foreground">{i18n.t('fullview_searchPlaceholder')}</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground">
            ⌘K
          </span>
        </Button>
        {onSettings && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onSettings}
            aria-label={i18n.t('settings_title')}
            className={NAV_CONTROL}
          >
            <SlidersHorizontal size={14} />
          </Button>
        )}
        {route.page === 'guide' && exportData && (
          <>
            {guideActions}
            <Button size="sm" variant="ghost" onClick={() => toggleEditing(exportData.guideId)} className={NAV_CONTROL}>
              {editing ? <Check size={14} /> : <Pencil size={14} />}
              {editing ? i18n.t('editor.done') : i18n.t('editor.edit')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(!historyOpen)} className={NAV_CONTROL}>
              <History size={14} />
              {i18n.t('editor.versionHistory')}
            </Button>
            {!editing && (
              <Button size="sm" onClick={() => setExportOpen(true)} className="h-8 rounded-lg">
                <Download size={14} />
                {i18n.t('common.export')}
              </Button>
            )}
            <ExportPreviewModal
              open={exportOpen}
              onOpenChange={setExportOpen}
              guide={exportData.guide}
              steps={exportData.steps}
              screenshots={exportData.screenshots}
            />
          </>
        )}
      </div>
    </header>
  );
}
