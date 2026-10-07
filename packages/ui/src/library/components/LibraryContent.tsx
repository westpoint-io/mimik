import { i18n } from '@mimik/core/env';
import {
  duplicateGuide,
  type GuideChangeEvent,
  getGuides,
  getStarredGuides,
  getTrashedGuides,
  onGuidesChanged,
  permanentlyDeleteGuide,
  restoreGuide,
  softDeleteGuide,
  toggleStar,
} from '@mimik/core/guides/service';
import type { Guide } from '@mimik/core/guides/types';
import { logger } from '@mimik/core/logger';
import { ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { navigate } from '../../navigation/lib/navigate';
import { useFullview } from '../../stores/use-fullview';
import { usePageFit } from '../hooks/use-page-fit';
import { bundleFrom } from '../lib/bundle-from';
import { loadCardData } from '../lib/load-card-data';
import { sortGuides } from '../lib/sort-guides';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { EmptyMascot } from './EmptyMascot';
import { GuideGridView } from './GuideGridView';
import { GuideListView } from './GuideListView';
import { ImportGuideModal } from './ImportGuideModal';

interface LibraryContentProps {
  category: 'all' | 'starred' | 'trash';
}

const emptyConfig: Record<LibraryContentProps['category'], { titleKey: string; subKey: string }> = {
  all: { titleKey: 'library.noGuidesTitle', subKey: 'library.noGuidesSub' },
  starred: { titleKey: 'library.noStarredTitle', subKey: 'library.noStarredSub' },
  trash: { titleKey: 'library.trashEmptyTitle', subKey: 'library.trashEmptySub' },
};

export function LibraryContent({ category }: LibraryContentProps) {
  const {
    setGuides,
    updateGuide,
    setThumbnails,
    setPlaces,
    sort,
    display,
    total,
    setTotal,
    page,
    pageKey,
    setPage,
    importFile,
    setImportFile,
    setCounts,
  } = useFullview((s) => ({
    setGuides: s.setGuides,
    updateGuide: s.updateGuide,
    setThumbnails: s.setThumbnails,
    setPlaces: s.setPlaces,
    sort: s.sort,
    display: s.display,
    total: s.total,
    setTotal: s.setTotal,
    page: s.page,
    pageKey: s.pageKey,
    setPage: s.setPage,
    importFile: s.importFile,
    setImportFile: s.setImportFile,
    setCounts: s.setCounts,
  }));

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [duplicateFailed, setDuplicateFailed] = useState(false);
  const dragDepth = useRef(0);

  const allGuidesRef = useRef<Guide[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const { columns, pageSize, thumbHeight } = usePageFit(rootRef, display);
  const key = `${category}:${sort}`;
  const shownRef = useRef({ page, pageKey });
  shownRef.current = { page, pageKey };

  const refreshCounts = useCallback(async () => {
    const [all, starred, trashed] = await Promise.all([getGuides(), getStarredGuides(), getTrashedGuides()]);
    setCounts({ all: all.length, starred: starred.length, trash: trashed.length });
  }, [setCounts]);

  const loadGuides = useCallback(async () => {
    const [all, starred, trashed] = await Promise.all([getGuides(), getStarredGuides(), getTrashedGuides()]);
    setCounts({ all: all.length, starred: starred.length, trash: trashed.length });

    const current = category === 'starred' ? starred : category === 'trash' ? trashed : all;
    allGuidesRef.current = current;
    setTotal(current.length);

    const lastPage = Math.max(0, Math.ceil(current.length / pageSize) - 1);
    const shown = shownRef.current.pageKey === key ? Math.min(shownRef.current.page, lastPage) : 0;
    const paged = sortGuides(current, sort).slice(shown * pageSize, (shown + 1) * pageSize);
    setGuides(paged);
    setPage(shown, key);

    const cards = await loadCardData(paged);
    setThumbnails(cards.thumbnails);
    setPlaces(cards.places);
  }, [category, sort, key, pageSize, setTotal, setPage, setCounts, setGuides, setThumbnails, setPlaces]);

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

  const totalPages = Math.ceil((total ?? 0) / pageSize);

  const applyPage = useCallback(
    async (newPage: number) => {
      const sorted = sortGuides(allGuidesRef.current, sort);
      const start = newPage * pageSize;
      const paged = sorted.slice(start, start + pageSize);
      setGuides(paged);
      setPage(newPage, key);

      const cards = await loadCardData(paged);
      setThumbnails(cards.thumbnails);
      setPlaces(cards.places);
    },
    [sort, key, pageSize, setPage, setGuides, setThumbnails, setPlaces],
  );

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
  const handleDuplicate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDuplicateFailed(false);
    try {
      if (!(await duplicateGuide(id))) throw new Error('guide not found');
    } catch (err) {
      logger.error(' Duplicate guide failed', err);
      setDuplicateFailed(true);
      return;
    }
    await loadGuides();
    await refreshCounts();
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

  const handleDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    dragDepth.current += 1;
    setDragging(true);
  };
  const handleDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    setImportFile(bundleFrom(e.dataTransfer.files));
  };

  const showPagination = total !== null && total > pageSize;

  return (
    <div
      ref={rootRef}
      className={`relative flex-1 flex flex-col ${display === 'list' ? 'w-full max-w-6xl mx-auto' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault();
      }}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-secondary/90 pointer-events-none">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-accent">
            <Upload size={16} />
            {i18n.t('import.dropHere')}
          </div>
        </div>
      )}
      {duplicateFailed && (
        <p role="alert" className="text-xs mb-3 text-center text-destructive">
          {i18n.t('library.duplicateFailed')}
        </p>
      )}
      {total === null ? (
        <p className="text-sm py-12 text-center text-purple">{i18n.t('common.loading')}</p>
      ) : total === 0 ? (
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
          onDuplicate={handleDuplicate}
        />
      ) : (
        <GuideGridView
          columns={columns}
          thumbHeight={thumbHeight}
          category={category}
          onStar={handleStar}
          onTrash={handleTrash}
          onRestore={handleRestore}
          onPermanentDelete={handlePermanentDelete}
          onDuplicate={handleDuplicate}
        />
      )}

      {showPagination && (
        <div className="sticky bottom-0 mt-auto flex items-center justify-center gap-3 pt-6 pb-2 bg-background">
          <button
            onClick={() => applyPage(page - 1)}
            disabled={page === 0}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-muted-foreground hover:border-violet hover:text-purple transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-xs font-medium text-muted-foreground">
            {i18n.t('guide.pageOf', [String(page + 1), String(totalPages)])}
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
      <ImportGuideModal
        file={importFile}
        onClose={() => setImportFile(null)}
        onImported={(guideId) => {
          setImportFile(null);
          navigate({ page: 'guide', guideId });
        }}
      />
    </div>
  );
}
