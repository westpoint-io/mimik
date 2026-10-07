import { i18n } from '@mimik/core/env';
import { createSnapshot } from '@mimik/core/guides/service';
import { logger } from '@mimik/core/logger';
import { Check, Download, History, Pencil, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { ExportPreviewModal } from '../../export/components/ExportPreviewModal';
import { LibraryTools } from '../../library/components/LibraryTools';
import { useFullview } from '../../stores/use-fullview';
import type { Route } from '../types';

interface TopBarProps {
  route: Route;
  guideActions?: ReactNode;
}

const NAV_CONTROL =
  'h-8 rounded-lg border border-border bg-card text-[13px] text-foreground hover:bg-secondary hover:text-accent';

const SEARCH_KEY = navigator.userAgent.includes('Mac') ? '⌘K' : 'Ctrl K';

export function TopBar({ route, guideActions }: TopBarProps) {
  const {
    guideExportData: exportData,
    setSearchOpen,
    editing,
    setEditing,
    historyOpen,
    setHistoryOpen,
    bumpHistoryRefresh,
  } = useFullview((s) => ({
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
    <header className="sticky top-0 z-30 flex items-center gap-3 px-7 h-16 shrink-0 bg-card border-b border-border">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setSearchOpen(true)}
        className={`w-72 justify-start ${NAV_CONTROL}`}
      >
        <Search size={14} className="shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left text-muted-foreground">{i18n.t('fullview_searchPlaceholder')}</span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground">
          {SEARCH_KEY}
        </span>
      </Button>

      <div className="ml-auto flex items-center gap-2">
        {route.page === 'library' && <LibraryTools />}
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
              <Button size="sm" onClick={() => setExportOpen(true)} className="h-8 rounded-lg text-[13px]">
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
