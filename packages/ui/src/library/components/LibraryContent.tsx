import { i18n } from '@mimik/core/env';
import {
  type GuideChangeEvent,
  getFirstScreenshot,
  getGuides,
  getStarredGuides,
  getTrashedGuides,
  onGuidesChanged,
  permanentlyDeleteGuide,
  restoreGuide,
  softDeleteGuide,
  toggleStar,
} from '@mimik/core/guides/service';
import type { Guide, Screenshot } from '@mimik/core/guides/types';
import {
  ArrowDownWideNarrow,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { useFullview } from '../../stores/use-fullview';
import { sortGuides } from '../lib/sort-guides';
import type { SortKey } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { EmptyMascot } from './EmptyMascot';
import { GuideGridView } from './GuideGridView';
import { GuideListView } from './GuideListView';

interface LibraryContentProps {
  category: 'all' | 'starred' | 'trash';
  onStartCapture?: () => void;
}

const emptyConfig: Record<string, { titleKey: string; subKey: string }> = {
  all: { titleKey: 'library_noGuidesTitle', subKey: 'library_noGuidesSub' },
  starred: { titleKey: 'library_noStarredTitle', subKey: 'library_noStarredSub' },
  trash: { titleKey: 'library_trashEmptyTitle', subKey: 'library_trashEmptySub' },
};

const sortLabelKeys: Record<SortKey, string> = {
  recent: 'sort_recentFirst',
  oldest: 'sort_oldestFirst',
  alpha: 'sort_alphaAZ',
  steps: 'sort_mostSteps',
};

const PAGE_SIZE = 9;

export function LibraryContent({ category, onStartCapture }: LibraryContentProps) {
  const {
    setGuides,
    updateGuide,
    setThumbnails,
    libraryLoading: loading,
    setLibraryLoading: setLoading,
    setCounts,
  } = useFullview((s) => ({
    setGuides: s.setGuides,
    updateGuide: s.updateGuide,
    setThumbnails: s.setThumbnails,
    libraryLoading: s.libraryLoading,
    setLibraryLoading: s.setLibraryLoading,
    setCounts: s.setCounts,
  }));

  const [display, setDisplay] = useState<'list' | 'grid'>(
    () => (localStorage.getItem('mimik-display') as 'list' | 'grid') || 'grid',
  );
  const [sort, setSort] = useState<SortKey>('recent');
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  const allGuidesRef = useRef<Guide[]>([]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const refreshCounts = useCallback(async () => {
    const [all, starred, trashed] = await Promise.all([getGuides(), getStarredGuides(), getTrashedGuides()]);
    setCounts({ all: all.length, starred: starred.length, trash: trashed.length });
  }, [setCounts]);

  const loadGuides = useCallback(async () => {
    setLoading(true);
    const [all, starred, trashed] = await Promise.all([getGuides(), getStarredGuides(), getTrashedGuides()]);
    setCounts({ all: all.length, starred: starred.length, trash: trashed.length });

    const current = category === 'starred' ? starred : category === 'trash' ? trashed : all;
    allGuidesRef.current = current;

    const sorted = sortGuides(current, sort);
    const paged = sorted.slice(0, PAGE_SIZE);
    setGuides(paged);
    setPage(0);

    const thumbMap = new Map<string, Screenshot>();
    for (const guide of current.slice(0, 20)) {
      const screenshot = await getFirstScreenshot(guide.id);
      if (screenshot) thumbMap.set(guide.id, screenshot);
    }
    setThumbnails(thumbMap);
    setLoading(false);
  }, [category, sort, setCounts, setGuides, setThumbnails, setLoading]);

  useEffect(() => {
    loadGuides();
  }, [loadGuides]);

  useEffect(
    () =>
      onGuidesChanged((event: GuideChangeEvent) => {
        if (event.type === 'starred') {
          updateGuide(event.id, { starred: event.starred });
          refreshCounts();
        } else {
          loadGuides();
        }
      }),
    [refreshCounts, loadGuides, updateGuide],
  );

  const totalPages = Math.ceil(allGuidesRef.current.length / PAGE_SIZE);

  const applyPage = useCallback(
    async (newPage: number) => {
      const sorted = sortGuides(allGuidesRef.current, sort);
      const start = newPage * PAGE_SIZE;
      const paged = sorted.slice(start, start + PAGE_SIZE);
      setGuides(paged);
      setPage(newPage);

      const thumbMap = new Map<string, Screenshot>();
      for (const guide of paged) {
        const screenshot = await getFirstScreenshot(guide.id);
        if (screenshot) thumbMap.set(guide.id, screenshot);
      }
      setThumbnails(thumbMap);
    },
    [sort, setGuides, setThumbnails],
  );

  const handleSort = (key: SortKey) => {
    setSort(key);
    setSortOpen(false);
    const sorted = sortGuides(allGuidesRef.current, key);
    setGuides(sorted.slice(0, PAGE_SIZE));
    setPage(0);
  };

  const toggleDisplay = () => {
    const next = display === 'list' ? 'grid' : 'list';
    setDisplay(next);
    localStorage.setItem('mimik-display', next);
  };

  const handleStar = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const guide = allGuidesRef.current.find((g) => g.id === id);
    if (guide) updateGuide(id, { starred: !guide.starred });
    await toggleStar(id);
    await refreshCounts();
  };
  const handleTrash = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await softDeleteGuide(id);
    await loadGuides();
  };
  const handleRestore = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await restoreGuide(id);
    await loadGuides();
  };
  const handlePermanentDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteTarget(id);
  };
  const confirmPermanentDelete = async () => {
    if (!deleteTarget) return;
    setDeleteTarget(null);
    await permanentlyDeleteGuide(deleteTarget);
    await loadGuides();
  };

  const showPagination = !loading && allGuidesRef.current.length > PAGE_SIZE;

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-4">
        {onStartCapture && category === 'all' && (
          <button
            onClick={onStartCapture}
            className="mr-auto flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Video size={15} />
            {i18n.t('sidepanel_startCapture')}
          </button>
        )}
        <div ref={sortRef} className="relative">
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-3 py-1.5 rounded-lg border border-border bg-card hover:border-violet hover:text-purple transition-colors"
          >
            <ArrowDownWideNarrow size={13} />
            {i18n.t(sortLabelKeys[sort] as any)}
            <ChevronDown size={10} className="ml-0.5" />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
              {(Object.keys(sortLabelKeys) as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => handleSort(key)}
                  className={`w-full text-left text-xs font-medium px-3 py-2 transition-colors ${
                    sort === key
                      ? 'text-foreground bg-secondary'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                  }`}
                >
                  {i18n.t(sortLabelKeys[key] as any)}
                </button>
              ))}
            </div>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleDisplay}
              className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-muted-foreground hover:border-violet hover:text-purple transition-colors"
            >
              {display === 'list' ? <LayoutGrid size={15} /> : <LayoutList size={15} />}
            </button>
          </TooltipTrigger>
          <TooltipContent align="end">
            {display === 'list' ? i18n.t('sort_gridView') : i18n.t('sort_listView')}
          </TooltipContent>
        </Tooltip>
      </div>

      {loading ? (
        <p className="text-sm py-12 text-center text-purple">{i18n.t('common_loading')}</p>
      ) : allGuidesRef.current.length === 0 ? (
        <div className="text-center py-20 flex flex-col items-center">
          <EmptyMascot category={category} />
          <p className="text-lg font-medium text-foreground mt-4">{i18n.t(emptyConfig[category].titleKey as any)}</p>
          <p className="text-sm text-muted-foreground mt-1">{i18n.t(emptyConfig[category].subKey as any)}</p>
        </div>
      ) : display === 'list' ? (
        <GuideListView
          category={category}
          onStar={handleStar}
          onTrash={handleTrash}
          onRestore={handleRestore}
          onPermanentDelete={handlePermanentDelete}
        />
      ) : (
        <GuideGridView
          category={category}
          onStar={handleStar}
          onTrash={handleTrash}
          onRestore={handleRestore}
          onPermanentDelete={handlePermanentDelete}
        />
      )}

      {showPagination && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => applyPage(page - 1)}
            disabled={page === 0}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-muted-foreground hover:border-violet hover:text-purple transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-xs font-medium text-muted-foreground">
            {i18n.t('fullview_pageOf', [String(page + 1), String(totalPages)])}
          </span>
          <button
            onClick={() => applyPage(page + 1)}
            disabled={page >= totalPages - 1}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-muted-foreground hover:border-violet hover:text-purple transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
      <ConfirmDeleteModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmPermanentDelete}
      />
    </div>
  );
}
