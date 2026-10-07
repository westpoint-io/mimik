import { i18n } from '@mimik/core/env';
import { createSnapshot, duplicateGuide } from '@mimik/core/guides/service';
import { logger } from '@mimik/core/logger';
import { Check, Copy, Download, History, MessageSquareQuote, Pencil, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { ExportPreviewModal } from '../../export/components/ExportPreviewModal';
import { LibraryTools } from '../../library/components/LibraryTools';
import { useFullview } from '../../stores/use-fullview';
import { navigate } from '../lib/navigate';
import type { Route } from '../types';

interface TopBarProps {
  route: Route;
  guideActions?: ReactNode;
}

const NAV_CONTROL =
  'h-8 rounded-lg border border-border bg-card text-[13px] text-foreground hover:bg-secondary hover:text-accent';

const SEARCH_KEY = navigator.userAgent.includes('Mac') ? '⌘K' : 'Ctrl K';

const DUPLICATE_SETTLE_MS = 700;

export function TopBar({ route, guideActions }: TopBarProps) {
  const {
    guideExportData: exportData,
    setSearchOpen,
    editing,
    setEditing,
    historyOpen,
    setHistoryOpen,
    bumpHistoryRefresh,
    transcriptOpen,
    setTranscriptOpen,
    hasTranscript,
  } = useFullview((s) => ({
    guideExportData: s.guideExportData,
    setSearchOpen: s.setSearchOpen,
    editing: s.editing,
    setEditing: s.setEditing,
    historyOpen: s.historyOpen,
    setHistoryOpen: s.setHistoryOpen,
    bumpHistoryRefresh: s.bumpHistoryRefresh,
    transcriptOpen: s.transcriptOpen,
    setTranscriptOpen: s.setTranscriptOpen,
    hasTranscript: s.hasTranscript,
  }));
  const [exportOpen, setExportOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const routeKey = route.page === 'guide' ? `guide/${route.guideId}` : `library/${route.category}`;
  const [duplicateFailedOnRoute, setDuplicateFailedOnRoute] = useState<string | null>(null);
  const [previousRoute, setPreviousRoute] = useState(routeKey);

  if (previousRoute !== routeKey) {
    setPreviousRoute(routeKey);
    setDuplicateFailedOnRoute(null);
  }

  const duplicateFailed = duplicateFailedOnRoute === routeKey;

  useEffect(() => () => clearTimeout(settleTimer.current ?? undefined), []);

  const handleDuplicate = async (guideId: string) => {
    if (duplicating) return;
    setDuplicating(true);
    setDuplicateFailedOnRoute(null);
    try {
      const copyId = await duplicateGuide(guideId);
      if (copyId) {
        navigate({ page: 'guide', guideId: copyId });
        settleTimer.current = setTimeout(() => setDuplicating(false), DUPLICATE_SETTLE_MS);
        return;
      }
    } catch (err) {
      logger.error(' Duplicate guide failed', err);
    }
    setDuplicateFailedOnRoute(routeKey);
    setDuplicating(false);
  };

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
    <>
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
              <Button
                size="sm"
                variant="ghost"
                onClick={() => toggleEditing(exportData.guideId)}
                className={NAV_CONTROL}
              >
                {editing ? <Check size={14} /> : <Pencil size={14} />}
                {editing ? i18n.t('editor.done') : i18n.t('editor.edit')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(!historyOpen)} className={NAV_CONTROL}>
                <History size={14} />
                {i18n.t('editor.versionHistory')}
              </Button>
              {hasTranscript && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTranscriptOpen(!transcriptOpen)}
                  className={NAV_CONTROL}
                >
                  <MessageSquareQuote size={14} />
                  {i18n.t('transcript.title')}
                </Button>
              )}
              {!editing && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={duplicating}
                    onClick={() => handleDuplicate(exportData.guideId)}
                    className={NAV_CONTROL}
                  >
                    <Copy size={14} />
                    {i18n.t('library.duplicate')}
                  </Button>
                  <Button size="sm" onClick={() => setExportOpen(true)} className="h-8 rounded-lg text-[13px]">
                    <Download size={14} />
                    {i18n.t('common.export')}
                  </Button>
                </>
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
      {duplicateFailed && (
        <p
          role="alert"
          className="text-xs py-2 px-7 text-center shrink-0 bg-card border-b border-border text-destructive"
        >
          {i18n.t('library.duplicateFailed')}
        </p>
      )}
    </>
  );
}
